import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AuthUser, UserRole } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AnonymousCredentialThrottle } from '../auth/throttle'
import { ClassesService } from './classes.service'
import { ClassEmailsDto, EnrollmentDecisionDto, UpdateClassAccessDto } from './dto/class-access.dto'

const STAFF = [UserRole.ORG_ADMIN, UserRole.TEACHER] as const

/** KwikEval classes: who may join a lecturer's course, and who is in it. */
@ApiTags('Classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  // ─── Students ─────────────────────────────────────────────────────────────

  // What a class link shows before signing in. Throttled so codes cannot be enumerated.
  @Public()
  @Get('join/:code')
  @AnonymousCredentialThrottle(150)
  @ApiOperation({ summary: 'Preview a class from its join link' })
  preview(@Param('code') code: string) {
    return this.classes.preview(code)
  }

  @Post('join/:code')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Join a class (or ask to) under the lecturer\'s access rule' })
  join(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.classes.join(code, user)
  }

  @Get('mine')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Classes I have joined or asked to join' })
  mine(@CurrentUser() user: AuthUser) {
    return this.classes.myClasses(user)
  }

  // ─── Lecturers ────────────────────────────────────────────────────────────

  @Get(':id/access')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Class link and access rule' })
  access(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classes.getAccess(id, user)
  }

  @Patch(':id/access')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Change how students can join' })
  updateAccess(@Param('id') id: string, @Body() dto: UpdateClassAccessDto, @CurrentUser() user: AuthUser) {
    return this.classes.updateAccess(id, dto, user)
  }

  @Post(':id/access/reset-link')
  @HttpCode(HttpStatus.OK)
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Replace the class link; the old one stops working' })
  resetLink(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classes.resetCode(id, user)
  }

  @Post(':id/emails')
  @HttpCode(HttpStatus.OK)
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Add emails to the class list' })
  addEmails(@Param('id') id: string, @Body() dto: ClassEmailsDto, @CurrentUser() user: AuthUser) {
    return this.classes.addEmails(id, dto, user)
  }

  @Delete(':id/emails/:email')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Remove an email from the class list' })
  removeEmail(@Param('id') id: string, @Param('email') email: string, @CurrentUser() user: AuthUser) {
    return this.classes.removeEmail(id, email, user)
  }

  @Get(':id/students')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Students in the class, waiting, or removed' })
  roster(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classes.roster(id, user)
  }

  @Patch(':id/students/:enrollmentId')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Let a student in, or remove them' })
  decide(
    @Param('id') id: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: EnrollmentDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.classes.decide(id, enrollmentId, dto, user)
  }
}
