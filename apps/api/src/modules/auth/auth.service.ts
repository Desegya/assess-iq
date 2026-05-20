import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { RegisterOrgDto } from './dto/register-org.dto'
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
      { sub: authUser.id, type: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await this.prisma.refreshToken.create({
      data: { userId: authUser.id, token: rawRefreshToken, expiresAt },
    })

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: 15 * 60 }
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
