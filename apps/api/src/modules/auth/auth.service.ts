import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { RegisterOrgDto } from './dto/register-org.dto'
import { JoinOrgDto } from './dto/join-org.dto'
import { RegisterStudentDto } from './dto/register-student.dto'
import { AuthUser, UserRole } from '@assessiq/types'

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
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        organization: { select: { id: true, name: true, plan: true, isActive: true } },
      },
    })

    if (!user) throw new UnauthorizedException('Invalid email or password')

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account has been suspended. Contact your administrator.')
    }
    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Your account is inactive. Contact your administrator.')
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password')

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
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: rawRefreshToken },
      include: { user: true },
    })

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.')
    }

    if (stored.user.organizationId === null && ['SUSPENDED', 'INACTIVE'].includes(stored.user.status)) {
      throw new UnauthorizedException('Account is unavailable')
    }

    // Revoke old token — rotation prevents replay attacks
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    })

    return this.generateTokenPair({
      id: stored.user.id,
      email: stored.user.email,
      role: stored.user.role as UserRole,
      organizationId: stored.user.organizationId,
    })
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: rawRefreshToken, isRevoked: false },
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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateTokenPair(authUser: AuthUser): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: authUser.id,
      email: authUser.email,
      role: authUser.role,
      organizationId: authUser.organizationId,
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

    await this.prisma.refreshToken.create({
      data: { userId: authUser.id, token: rawRefreshToken, expiresAt },
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
