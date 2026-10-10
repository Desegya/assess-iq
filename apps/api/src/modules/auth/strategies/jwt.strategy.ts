import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthUser } from '@assessiq/types'

interface JwtPayload {
  sub: string
  email: string
  role: string
  organizationId: string | null
  iat: number
  exp: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token')
    }

    // Nightklass status changes take effect even for an already-issued access token.
    // Institutional JWT behavior remains unchanged.
    if (payload.organizationId === null) {
      const account = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true, organizationId: true } })
      if (!account || account.organizationId !== null || ['SUSPENDED', 'INACTIVE'].includes(account.status)) throw new UnauthorizedException('Account is unavailable')
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AuthUser['role'],
      organizationId: payload.organizationId,
    }
  }
}
