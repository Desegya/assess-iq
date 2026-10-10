import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle, SkipThrottle, ThrottlerGuard } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterOrgDto } from './dto/register-org.dto'
import { JoinOrgDto } from './dto/join-org.dto'
import { RegisterStudentDto } from './dto/register-student.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import { AuthUser } from '@assessiq/types'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 5 registration attempts per 15 minutes per IP
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Register a new organisation and admin account' })
  register(@Body() dto: RegisterOrgDto) {
    return this.authService.registerOrg(dto)
  }

  // 10 login attempts per 15 minutes per IP (brute-force protection)
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  // Refresh is called by the SDK on every page load — slightly lenient
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Get a new access token using refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token and log out' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken)
  }

  // Validate a join code and return the org name (used by /join page before registration)
  @Public()
  @Get('org/:joinCode')
  @SkipThrottle()
  @ApiOperation({ summary: 'Look up an organisation by join code' })
  lookupOrg(@Param('joinCode') joinCode: string) {
    return this.authService.lookupOrg(joinCode)
  }

  // Student self-registration via join code
  @Public()
  @Post('join')
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Student self-registers using an org join code' })
  joinOrg(@Body() dto: JoinOrgDto) {
    return this.authService.joinOrg(dto)
  }

  // Standalone student registration — no organisation/join code required
  // (e.g. a Nightklass user whose school hasn't adopted the assessment side)
  @Public()
  @Post('register-student')
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Register a standalone student account with no organisation' })
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto)
  }

  @Get('me')
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id)
  }
}
