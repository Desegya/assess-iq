import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterOrgDto } from './dto/register-org.dto'
import { JoinOrgDto } from './dto/join-org.dto'
import { RegisterStudentDto } from './dto/register-student.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { EmailTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto/account-recovery.dto'
import { Public } from './decorators/public.decorator'
import { AnonymousCredentialThrottle } from './throttle'
import { CurrentUser } from './decorators/current-user.decorator'
import { AuthUser } from '@assessiq/types'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Organisation sign-up is rare; keep the per-address budget tight.
  @Public()
  @Post('register')
  @AnonymousCredentialThrottle(10)
  @ApiOperation({ summary: 'Register a new organisation and admin account' })
  register(@Body() dto: RegisterOrgDto) {
    return this.authService.registerOrg(dto)
  }

  // Sized for a class signing in from one school or carrier network; password
  // guessing is capped per account by LoginAttemptLimiter.
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AnonymousCredentialThrottle(300)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  // Refresh runs on page load and every access-token expiry for every learner on a network.
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @AnonymousCredentialThrottle(1500)
  @ApiOperation({ summary: 'Get a new access token using refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token and log out' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken)
  }

  // Validate a join code and return the org name (used by /join page before registration)
  @Public()
  @Get('org/:joinCode')
  @AnonymousCredentialThrottle(150)
  @ApiOperation({ summary: 'Look up an organisation by join code' })
  lookupOrg(@Param('joinCode') joinCode: string) {
    return this.authService.lookupOrg(joinCode)
  }

  // Student self-registration via join code
  @Public()
  @Post('join')
  @AnonymousCredentialThrottle(150)
  @ApiOperation({ summary: 'Student self-registers using an org join code' })
  joinOrg(@Body() dto: JoinOrgDto) {
    return this.authService.joinOrg(dto)
  }

  // Standalone student registration — no organisation/join code required
  // (e.g. a Nightklass user whose school hasn't adopted the assessment side)
  @Public()
  @Post('register-student')
  @AnonymousCredentialThrottle(150)
  @ApiOperation({ summary: 'Register a standalone student account with no organisation' })
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto)
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id)
  }

  // ─── Account recovery ───────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @AnonymousCredentialThrottle(100)
  @ApiOperation({ summary: 'Email a single-use password reset link (response never reveals whether the account exists)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email)
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @AnonymousCredentialThrottle(100)
  @ApiOperation({ summary: 'Set a new password with a reset link; signs out every existing session' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password)
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @AnonymousCredentialThrottle(100)
  verifyEmail(@Body() dto: EmailTokenDto) {
    return this.authService.verifyEmail(dto.token)
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.authService.resendVerification(user.id)
  }
}
