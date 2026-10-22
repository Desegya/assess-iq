import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { CreateStudentDto } from './dto/create-student.dto'
import { BulkCreateStudentsDto } from './dto/bulk-create-students.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { DeleteAccountDto } from './dto/delete-account.dto'
import { AccountDataService } from './account-data.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuthUser, UserRole } from '@assessiq/types'

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountData: AccountDataService,
  ) {}

  // POST /users/students — teacher/admin creates a student account
  @Post('students')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a student account (teacher/admin only)' })
  createStudent(
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.createStudent(dto, user)
  }

  // GET /users/students — list all students in the org
  @Get('students')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'List all students in the organisation' })
  listStudents(@CurrentUser() user: AuthUser) {
    return this.usersService.findStudents(user)
  }

  // POST /users/students/bulk — bulk import from CSV data
  @Post('students/bulk')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Bulk create student accounts (max 500)' })
  bulkCreateStudents(@Body() dto: BulkCreateStudentsDto, @CurrentUser() user: AuthUser) {
    return this.usersService.bulkCreateStudents(dto, user)
  }

  // GET /users/org/join-code — get the org's join code for sharing
  @Get('org/join-code')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get the organisation join code' })
  getOrgJoinCode(@CurrentUser() user: AuthUser) {
    return this.usersService.getOrgJoinCode(user)
  }

  // GET /users/me/profile — the signed-in user's academic profile
  @Get('me/profile')
  @ApiOperation({ summary: "Get the current user's academic profile" })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user)
  }

  // PATCH /users/me/profile — set during Nightklass onboarding, editable later
  @Patch('me/profile')
  @ApiOperation({ summary: "Create or update the current user's academic profile" })
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.usersService.updateProfile(dto, user)
  }

  // GET /users/me/export — every record held about a standalone learner, as JSON
  @Get('me/export')
  @ApiOperation({ summary: 'Download a copy of my Nightklass data' })
  exportMine(@CurrentUser() user: AuthUser) {
    return this.accountData.export(user)
  }

  // DELETE /users/me — permanent self-service deletion for standalone learners
  @Delete('me')
  @ApiOperation({ summary: 'Permanently delete my Nightklass account and learning data' })
  deleteMine(@Body() dto: DeleteAccountDto, @CurrentUser() user: AuthUser) {
    return this.accountData.delete(user, dto.password)
  }

  // GET /users/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findOne(id, user)
  }

  // PATCH /users/:id/deactivate
  @Patch(':id/deactivate')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Deactivate a user account' })
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.deactivate(id, user)
  }
}
