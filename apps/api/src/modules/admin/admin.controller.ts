import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreateCourseDto } from '../courses/dto/create-course.dto'
import { UpdateCourseDto } from '../courses/dto/update-course.dto'
import { CreateTopicDto } from '../topics/dto/create-topic.dto'
import { UpdateTopicDto } from '../topics/dto/update-topic.dto'
import { AdminService } from './admin.service'
import { NightklassAdminGuard } from './admin.guard'
import {
  AdminAccessDto,
  AdminLessonDto,
  AdminQueryDto,
  AdminQuestionDto,
  AdminReasonDto,
  AdminReportDto,
  AdminStatusDto,
} from './admin.dto'

@ApiTags('Nightklass administration')
@ApiBearerAuth()
@Controller('admin/nightklass')
@UseGuards(NightklassAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('me') me(@CurrentUser() u: AuthUser) {
    return this.admin.me(u.id)
  }
  @Get('overview') overview() {
    return this.admin.overview()
  }
  @Get('users') users(@Query() q: AdminQueryDto) {
    return this.admin.users(q)
  }
  @Get('users/:id') user(@Param('id') id: string) {
    return this.admin.user(id)
  }
  @Patch('users/:id/status') status(
    @Param('id') id: string,
    @Body() dto: AdminStatusDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.status(id, dto, u.id)
  }
  @Patch('users/:id/admin-access') access(
    @Param('id') id: string,
    @Body() dto: AdminAccessDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.access(id, dto, u.id)
  }
  @Get('access') admins() {
    return this.admin.admins()
  }
  @Get('courses') courses(@Query() q: AdminQueryDto) {
    return this.admin.courses(q)
  }
  @Get('courses/:id') course(@Param('id') id: string, @Query() q: AdminQueryDto) {
    return this.admin.courseDetail(id, q)
  }
  @Post('users/:id/courses') createCourse(
    @Param('id') id: string,
    @Body() dto: CreateCourseDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.createCourse(id, dto, u.id)
  }
  @Patch('courses/:id') updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.updateCourse(id, dto, u.id)
  }
  @Post('courses/:id/topics') createTopic(
    @Param('id') id: string,
    @Body() dto: CreateTopicDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.createTopic(id, dto, u.id)
  }
  @Patch('topics/:id') updateTopic(
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.updateTopic(id, dto, u.id)
  }
  @Post('topics/:id/archive') archiveTopic(
    @Param('id') id: string,
    @Body() dto: AdminReasonDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.topicState(id, true, dto.reason, u.id)
  }
  @Post('topics/:id/restore') restoreTopic(
    @Param('id') id: string,
    @Body() dto: AdminReasonDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.topicState(id, false, dto.reason, u.id)
  }
  @Get('lessons') lessons(@Query() q: AdminQueryDto) {
    return this.admin.lessons(q)
  }
  @Get('lessons/:id') lesson(@Param('id') id: string) {
    return this.admin.lesson(id)
  }
  @Post('lessons/:id/correct') correctLesson(
    @Param('id') id: string,
    @Body() dto: AdminLessonDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.updateLesson(id, dto, u.id)
  }
  @Get('questions') questions(@Query() q: AdminQueryDto) {
    return this.admin.questions(q)
  }
  @Get('questions/:id') question(@Param('id') id: string) {
    return this.admin.question(id)
  }
  @Post('questions') createQuestion(@Body() dto: AdminQuestionDto, @CurrentUser() u: AuthUser) {
    return this.admin.saveQuestion(null, dto, u.id)
  }
  @Patch('questions/:id') updateQuestion(
    @Param('id') id: string,
    @Body() dto: AdminQuestionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.saveQuestion(id, dto, u.id)
  }
  @Get('materials') documents(@Query() q: AdminQueryDto) {
    return this.admin.documents(q)
  }
  @Get('reports') reports(@Query() q: AdminQueryDto) {
    return this.admin.reports(q)
  }
  @Patch('reports/:id') resolveReport(
    @Param('id') id: string,
    @Body() dto: AdminReportDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.resolveReport(id, dto, u.id)
  }
  @Get('activity') activity(@Query() q: AdminQueryDto) {
    return this.admin.activity(q)
  }
  @Get('audit') audit(@Query() q: AdminQueryDto) {
    return this.admin.auditLogs(q)
  }
}
