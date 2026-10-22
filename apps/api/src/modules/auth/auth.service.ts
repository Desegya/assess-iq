import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { RegisterOrgDto } from './dto/register-org.dto'
import { JoinOrgDto } from './dto/join-org.dto'
import { RegisterStudentDto } from './dto/register-student.dto'
import { AuthUser, UserRole } from '@assessiq/types'
import { EmailService } from '../email/email.service'
import { LoginAttemptLimiter } from './login-attempt-limiter'

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

interface JwtPayload {
  sub: string
  email: string
  role: string
  organizationId: string | null
  /** User.sessionVersion at issue time; a bump revokes every outstanding access token. */
  sv: number
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// A rotated refresh token presented again within this window is treated as a
// benign race (two tabs refreshing together), not as theft.
const ROTATION_GRACE_MS = 20_000
const RESET_TOKEN_TTL_MS = 30 * 60_000
const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60_000
// Compared against when the email is unknown, so response time does not reveal registration.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 12)

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly loginLimiter: LoginAttemptLimiter,
    private readonly email: EmailService,
  ) {}
  private readonly logger = new Logger(AuthService.name)

  // ─── Register ─────────────────────────────────────────────────────────────

  async registerOrg(dto: RegisterOrgDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    })
    if (existing) {
      throw new ConflictException('An account with this email already exists')
    }

    const slug = this.generateSlug(dto.orgName)
    const existingOrg = await this.prisma.organization.findUnique({ where: { slug } })
    if (existingOrg) {
      throw new ConflictException('An organisation with this name already exists')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const { user, organization } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.orgName,
          slug,
          joinCode: this.generateJoinCode(),
          type: dto.orgType as never,
          country: dto.country ?? 'Nigeria',
          plan: 'FREE_TRIAL',
          trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })

      const user = await tx.user.create({
        data: {
          name: dto.adminName,
          email: dto.adminEmail,
          passwordHash,
          role: 'ORG_ADMIN',
          status: 'ACTIVE',
          organizationId: organization.id,
        },
      })

      return { user, organization }
    })

    const tokens = await this.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
    })

    return { user: this.sanitizeUser(user), organization, ...tokens }
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    this.loginLimiter.assertAllowed(dto.email)
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        organization: { select: { id: true, name: true, plan: true, isActive: true } },
      },
    })

    if (!user || user.deletedAt) {
      await bcrypt.compare(dto.password, DUMMY_HASH)
      this.loginLimiter.recordFailure(dto.email)
      throw new UnauthorizedException('Invalid email or password')
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account has been suspended. Contact your administrator.')
    }
    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Your account is inactive. Contact your administrator.')
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!passwordValid) {
      this.loginLimiter.recordFailure(dto.email)
      throw new UnauthorizedException('Invalid email or password')
    }
    this.loginLimiter.reset(dto.email)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const tokens = await this.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
    })

    return { user: this.sanitizeUser(user), organization: user.organization, ...tokens }
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const expired = () => new UnauthorizedException('Session expired. Please log in again.')
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hashToken(rawRefreshToken) },
      include: { user: true },
    })
    if (!stored || stored.expiresAt < new Date() || stored.user.deletedAt) throw expired()

    if (stored.isRevoked) {
      const benignRace =
        stored.rotatedAt && Date.now() - stored.rotatedAt.getTime() < ROTATION_GRACE_MS
      if (!benignRace) {
        // A rotated token came back: assume it was stolen and end the whole session chain.
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, isRevoked: false },
          data: { isRevoked: true },
        })
        this.logger.warn(`event=refresh_token_reuse userId=${stored.userId} family=${stored.familyId}`)
        throw expired()
      }
      // Logout or password reset revokes the family; never resurrect those sessions.
      const live = await this.prisma.refreshToken.count({
        where: { familyId: stored.familyId, isRevoked: false, expiresAt: { gt: new Date() } },
      })
      if (!live) throw expired()
    }

    if (stored.user.organizationId === null && ['SUSPENDED', 'INACTIVE'].includes(stored.user.status)) {
      throw new UnauthorizedException('Account is unavailable')
    }

    // Rotate: the presented token is revoked and its successor joins the same family.
    if (!stored.isRevoked) {
      const rotated = await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, isRevoked: false },
        data: { isRevoked: true, rotatedAt: new Date() },
      })
      if (!rotated.count) return this.refresh(rawRefreshToken)
    }

    return this.generateTokenPair(
      {
        id: stored.user.id,
        email: stored.user.email,
        role: stored.user.role as UserRole,
        organizationId: stored.user.organizationId,
      },
      stored.familyId,
    )
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hashToken(rawRefreshToken) },
      select: { familyId: true },
    })
    if (stored)
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, isRevoked: false },
        data: { isRevoked: true },
      })
    return { message: 'Logged out successfully' }
  }

  // ─── Me ───────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        organization: {
          select: { id: true, name: true, plan: true, type: true, logoUrl: true },
        },
      },
    })
    return this.sanitizeUser(user)
  }

  // ─── Student self-registration ────────────────────────────────────────────

  async lookupOrg(joinCode: string) {
    const org = await this.prisma.organization.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
      select: { id: true, name: true, type: true, isActive: true },
    })
    if (!org || !org.isActive) throw new NotFoundException('Invalid or expired join code')
    return org
  }

  async joinOrg(dto: JoinOrgDto) {
    const org = await this.lookupOrg(dto.joinCode)

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('An account with this email already exists')

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        organizationId: org.id,
      },
    })

    const tokens = await this.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
    })

    return { user: this.sanitizeUser(user), ...tokens }
  }

  // ─── Standalone student registration (no organisation, e.g. Nightklass) ───

  async registerStudent(dto: RegisterStudentDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('An account with this email already exists')

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        organizationId: null,
        ...(dto.privacyNoticeVersion
          ? { privacyNoticeVersion: dto.privacyNoticeVersion, privacyAcceptedAt: new Date() }
          : {}),
      },
    })
    await this.sendVerification(user.id, user.email, user.name)

    const tokens = await this.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
    })

    return { user: this.sanitizeUser(user), ...tokens }
  }

  // ─── Account recovery and email verification ─────────────────────────────

  private async issueEmailToken(userId: string, purpose: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION') {
    const token = randomBytes(32).toString('base64url')
    const ttl = purpose === 'PASSWORD_RESET' ? RESET_TOKEN_TTL_MS : VERIFY_TOKEN_TTL_MS
    await this.prisma.$transaction([
      // Only the newest link of each kind works.
      this.prisma.emailToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailToken.create({
        data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttl) },
      }),
    ])
    return token
  }

  /** Always resolves with the same message so the response never reveals whether an account exists. */
  async requestPasswordReset(email: string) {
    const generic = {
      message: 'If an account exists for that email, a reset link has been sent. It expires in 30 minutes.',
    }
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    })
    if (!user || user.deletedAt || user.status === 'SUSPENDED') return generic
    // At most three reset emails per account per hour.
    const recent = await this.prisma.emailToken.count({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', createdAt: { gt: new Date(Date.now() - 3600_000) } },
    })
    if (recent >= 3) return generic
    const token = await this.issueEmailToken(user.id, 'PASSWORD_RESET')
    await this.email.sendPasswordReset(user.email, user.name, token).catch((err) =>
      this.logger.error(`event=password_reset_email_failed userId=${user.id} reason=${err instanceof Error ? err.message : 'unknown'}`),
    )
    return generic
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = hashToken(token)
    const passwordHash = await bcrypt.hash(password, 12)
    const userId = await this.prisma.$transaction(async (tx) => {
      // Consuming the token and changing the password are one atomic step, so a link works once.
      const consumed = await tx.emailToken.updateMany({
        where: { tokenHash, purpose: 'PASSWORD_RESET', usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      })
      if (!consumed.count) throw new BadRequestException('This reset link is invalid or has expired. Request a new one.')
      const { userId } = await tx.emailToken.findUniqueOrThrow({ where: { tokenHash } })
      await tx.user.update({
        where: { id: userId },
        // Receiving the link proves control of the address.
        data: { passwordHash, sessionVersion: { increment: 1 }, emailVerifiedAt: new Date() },
      })
      await tx.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } })
      return userId
    })
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    this.loginLimiter.reset(user.email)
    return { message: 'Your password has been reset. Sign in with your new password.' }
  }

  private async sendVerification(userId: string, email: string, name: string) {
    try {
      const token = await this.issueEmailToken(userId, 'EMAIL_VERIFICATION')
      await this.email.sendEmailVerification(email, name, token)
    } catch (err) {
      // Verification is not required to sign in, so a delivery failure must not block registration.
      this.logger.error(`event=verification_email_failed userId=${userId} reason=${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.emailVerifiedAt) return { message: 'Your email is already verified.' }
    const recent = await this.prisma.emailToken.count({
      where: { userId, purpose: 'EMAIL_VERIFICATION', createdAt: { gt: new Date(Date.now() - 3600_000) } },
    })
    if (recent < 3) await this.sendVerification(user.id, user.email, user.name)
    return { message: 'If your email is not yet verified, a new link has been sent.' }
  }

  async verifyEmail(token: string) {
    const tokenHash = hashToken(token)
    const ok = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailToken.updateMany({
        where: { tokenHash, purpose: 'EMAIL_VERIFICATION', usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      })
      if (!consumed.count) return false
      const { userId } = await tx.emailToken.findUniqueOrThrow({ where: { tokenHash } })
      await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
      return true
    })
    if (!ok) throw new BadRequestException('This verification link is invalid or has expired.')
    return { message: 'Email verified.' }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateTokenPair(authUser: AuthUser, familyId?: string): Promise<TokenPair> {
    const { sessionVersion } = await this.prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
      select: { sessionVersion: true },
    })
    const payload: JwtPayload = {
      sub: authUser.id,
      email: authUser.email,
      role: authUser.role,
      organizationId: authUser.organizationId,
      sv: sessionVersion,
    }

    const jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN', '15m')
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')

    const accessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiresIn })

    const rawRefreshToken = this.jwtService.sign(
      { sub: authUser.id, type: 'refresh', jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    )

    // Parse config value instead of hardcoding 7 days
    const expiresAt = this.parseExpiryToDate(refreshExpiresIn)
    const accessExpiresIn = this.parseDurationToSeconds(jwtExpiresIn)

    const id = randomUUID()
    await this.prisma.refreshToken.create({
      data: { id, userId: authUser.id, token: hashToken(rawRefreshToken), familyId: familyId ?? id, expiresAt },
    })

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: accessExpiresIn }
  }

  /**
   * Parse a JWT duration string like "15m", "7d", "1h" into seconds.
   */
  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/)
    if (!match) return 15 * 60 // fallback 15 minutes
    const n = parseInt(match[1]!, 10)
    const unit = match[2]!
    const multiplier: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
    return n * (multiplier[unit] ?? 60)
  }

  /**
   * Convert a JWT duration string to a concrete expiry Date.
   */
  private parseExpiryToDate(duration: string): Date {
    return new Date(Date.now() + this.parseDurationToSeconds(duration) * 1000)
  }

  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion
    const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    return `${rand(4)}-${rand(4)}`
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .slice(0, 60)
  }

  private sanitizeUser(user: { passwordHash: string; [key: string]: unknown }) {
    const { passwordHash: _pw, ...safe } = user
    return safe
  }
}
