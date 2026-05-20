import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
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
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    })
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token')
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AuthUser['role'],
      organizationId: payload.organizationId,
    }
  }
}
