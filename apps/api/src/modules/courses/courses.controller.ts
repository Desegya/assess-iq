import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CoursesService } from './courses.service'
import { CreateCourseDto } from './dto/create-course.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AuthUser, UserRole } from '@assessiq/types'

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new course' })
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.create(dto, user)
  }

  @Get()
  @ApiOperation({ summary: 'List courses for the current organisation' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.coursesService.findAll(user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single course with topics' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.coursesService.findOne(id, user)
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a course' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCourseDto>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.update(id, dto, user)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TEACHER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a course' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.coursesService.remove(id, user)
  }
}
