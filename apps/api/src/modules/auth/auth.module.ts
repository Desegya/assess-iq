import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { AppThrottlerGuard } from './throttle'
import { LoginAttemptLimiter } from './login-attempt-limiter'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Apply JWT guard globally — all routes require auth unless decorated @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Apply roles guard globally — RBAC enforced via @Roles()
    { provide: APP_GUARD, useClass: RolesGuard },
    // Registered after the JWT guard so authenticated requests are tracked per account.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    LoginAttemptLimiter,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
