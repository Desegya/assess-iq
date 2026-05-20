import {
  Controller,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuthUser, UserRole } from '@assessiq/types'

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
