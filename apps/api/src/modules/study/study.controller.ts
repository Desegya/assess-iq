import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { StudyService } from './study.service'
import { SetAvailabilityDto } from './dto/set-availability.dto'
import { GeneratePlanDto } from './dto/generate-plan.dto'
import { CompleteSessionDto } from './dto/complete-session.dto'
import { GenerateQuizDto } from './dto/generate-quiz.dto'
import { SubmitQuizDto } from './dto/submit-quiz.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthUser } from '@assessiq/types'

@ApiTags('Study')
@ApiBearerAuth()
@Controller('study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  // ─── Availability ─────────────────────────────────────────────────────────

  @Get('availability')
  @ApiOperation({ summary: "Get the student's weekly study availability" })
  getAvailability(@CurrentUser() user: AuthUser) {
    return this.studyService.getAvailability(user)
  }

  @Post('availability')
  @ApiOperation({ summary: "Replace the student's weekly study availability" })
  setAvailability(@Body() dto: SetAvailabilityDto, @CurrentUser() user: AuthUser) {
    return this.studyService.setAvailability(dto, user)
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Post('plans/generate')
  @ApiOperation({ summary: 'Generate a study plan for a course up to its exam date' })
  generatePlan(@Body() dto: GeneratePlanDto, @CurrentUser() user: AuthUser) {
    return this.studyService.generatePlan(dto, user)
  }

  @Get('plans/current')
  @ApiQuery({ name: 'courseId', required: true })
  @ApiOperation({ summary: 'Get the active study plan for a course' })
  getCurrentPlan(@Query('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.studyService.getCurrentPlan(courseId, user)
  }

  @Post('plans/:id/redistribute')
  @ApiOperation({ summary: 'Redistribute missed sessions into future available slots' })
  redistribute(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.studyService.redistribute(id, user)
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  @Get('sessions/today')
  @ApiOperation({ summary: "Get today's study sessions" })
  getTodaySessions(@CurrentUser() user: AuthUser) {
    return this.studyService.getTodaySessions(user)
  }

  @Post('sessions/:id/complete')
  @ApiOperation({ summary: 'Mark a study session complete' })
  completeSession(
    @Param('id') id: string,
    @Body() dto: CompleteSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studyService.completeSession(id, dto, user)
  }

  // ─── Self-quizzes ─────────────────────────────────────────────────────────

  @Post('topics/:topicId/quiz/generate')
  @ApiOperation({ summary: 'Generate a self-quiz for a topic' })
  generateQuiz(
    @Param('topicId') topicId: string,
    @Body() dto: GenerateQuizDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studyService.generateQuiz(topicId, dto, user)
  }

  @Post('topics/:topicId/quiz/submit')
  @ApiOperation({ summary: 'Submit answers for a self-quiz' })
  submitQuiz(
    @Param('topicId') topicId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studyService.submitQuiz(topicId, dto, user)
  }

  // ─── Weak topics ──────────────────────────────────────────────────────────

  @Get('topics/weak')
  @ApiOperation({ summary: "List the student's weak topics" })
  getWeakTopics(@CurrentUser() user: AuthUser) {
    return this.studyService.getWeakTopics(user)
  }
}
