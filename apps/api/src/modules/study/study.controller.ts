import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger'
import { StudyService } from './study.service'
import { SetAvailabilityDto } from './dto/set-availability.dto'
import { GeneratePlanDto, SetExamDateDto } from './dto/generate-plan.dto'
import { CompleteSessionDto } from './dto/complete-session.dto'
import { GenerateQuizDto } from './dto/generate-quiz.dto'
import { SubmitQuizDto } from './dto/submit-quiz.dto'
import { GenerateFlashcardsDto } from './dto/generate-flashcards.dto'
import { ReviewFlashcardDto } from './dto/review-flashcard.dto'
import { ChatDto } from './dto/chat.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthUser } from '@assessiq/types'
import { SuggestCoursesDto } from './dto/suggest-courses.dto'
import { OutlineTextDto, ExpandOutlineDto } from './dto/outline.dto'

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

  @Post('plans/:id/exam-date')
  @ApiOperation({ summary: 'Set or change the exam date on a plan and re-plan the remaining sessions around it' })
  setExamDate(@Param('id') id: string, @Body() dto: SetExamDateDto, @CurrentUser() user: AuthUser) {
    return this.studyService.setExamDate(id, dto.examDate, user)
  }

  @Post('plans/:id/adapt')
  @ApiOperation({ summary: 'Re-plan from today using missed sessions, quiz results, outline edits and exam proximity' })
  adaptPlan(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.studyService.adaptPlan(id, user)
  }

  @Get('courses/:courseId/readiness')
  @ApiOperation({ summary: 'Exam readiness score with per-topic mastery and coverage' })
  getReadiness(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.studyService.getReadiness(courseId, user)
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

  @Get('topics/:topicId/quiz/history')
  @ApiOperation({ summary: 'Recent self-quiz attempts and the recommended next difficulty' })
  getQuizHistory(@Param('topicId') topicId: string, @CurrentUser() user: AuthUser) {
    return this.studyService.getQuizHistory(topicId, user)
  }

  @Post('quiz-attempts/:id/flashcards')
  @ApiOperation({ summary: 'Create flashcards from the questions missed in a self-quiz attempt' })
  flashcardsFromAttempt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.studyService.flashcardsFromAttempt(id, user)
  }

  // ─── Weak topics ──────────────────────────────────────────────────────────

  @Get('topics/weak')
  @ApiOperation({ summary: "List the student's weak topics" })
  getWeakTopics(@CurrentUser() user: AuthUser) {
    return this.studyService.getWeakTopics(user)
  }

  // ─── Flashcards ───────────────────────────────────────────────────────────

  @Post('topics/:topicId/flashcards/generate')
  @ApiOperation({ summary: 'Generate spaced-repetition flashcards for a topic' })
  generateFlashcards(
    @Param('topicId') topicId: string,
    @Body() dto: GenerateFlashcardsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studyService.generateFlashcards(topicId, dto, user)
  }

  @Get('flashcards/due')
  @ApiQuery({ name: 'courseId', required: false })
  @ApiOperation({ summary: "Get the student's flashcards due for review" })
  getDueFlashcards(@CurrentUser() user: AuthUser, @Query('courseId') courseId?: string) {
    return this.studyService.getDueFlashcards(user, courseId)
  }

  @Get('flashcards')
  @ApiQuery({ name: 'courseId', required: false })
  @ApiOperation({ summary: "List all of the student's flashcards" })
  listFlashcards(@CurrentUser() user: AuthUser, @Query('courseId') courseId?: string) {
    return this.studyService.listFlashcards(user, courseId)
  }

  @Post('flashcards/:id/review')
  @ApiOperation({ summary: 'Submit a spaced-repetition review rating for a flashcard' })
  reviewFlashcard(
    @Param('id') id: string,
    @Body() dto: ReviewFlashcardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studyService.reviewFlashcard(id, dto, user)
  }

  @Delete('flashcards/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a flashcard' })
  removeFlashcard(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.studyService.removeFlashcard(id, user)
  }

  // ─── Progress & streaks ───────────────────────────────────────────────────

  @Get('progress')
  @ApiOperation({ summary: "Get the student's streak and per-course progress" })
  getProgress(@CurrentUser() user: AuthUser) {
    return this.studyService.getProgress(user)
  }

  // ─── Course suggestions ───────────────────────────────────────────────────

  @Post('course-suggestions')
  @ApiOperation({ summary: "Suggest likely courses from the student's programme, level and semester (AI, not official)" })
  suggestCourses(@Body() dto: SuggestCoursesDto, @CurrentUser() user: AuthUser) {
    return this.studyService.suggestCourses(dto, user)
  }

  // ─── Course outline ───────────────────────────────────────────────────────

  @Post('courses/:courseId/outline/text')
  @ApiOperation({ summary: 'Save a pasted course outline and propose topics from it' })
  outlineFromText(@Param('courseId') courseId: string, @Body() dto: OutlineTextDto, @CurrentUser() user: AuthUser) {
    return this.studyService.outlineFromText(courseId, dto.text, user)
  }

  @Post('courses/:courseId/outline/document/:documentId')
  @ApiOperation({ summary: 'Use an uploaded document as the course outline and propose topics from it' })
  outlineFromDocument(
    @Param('courseId') courseId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studyService.outlineFromDocument(courseId, documentId, user)
  }

  @Post('courses/:courseId/outline/photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Read a photographed outline or prospectus page and propose topics from it' })
  outlineFromPhoto(
    @Param('courseId') courseId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10 MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studyService.outlineFromPhoto(courseId, file, user)
  }

  @Post('courses/:courseId/outline/expand')
  @ApiOperation({ summary: 'Expand the outline with AI subtopics (kept separate from the original outline)' })
  expandOutline(@Param('courseId') courseId: string, @Body() dto: ExpandOutlineDto, @CurrentUser() user: AuthUser) {
    return this.studyService.expandOutline(courseId, dto.topicId, user)
  }

  // ─── Topic suggestions & notes ────────────────────────────────────────────

  @Post('courses/:courseId/topics/suggest')
  @ApiOperation({ summary: 'Suggest topics for a course from its title alone (no uploaded material needed)' })
  suggestTopics(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.studyService.suggestTopics(courseId, user)
  }

  // ─── AI study chat ────────────────────────────────────────────────────────

  @Post('courses/:courseId/chat')
  @ApiOperation({ summary: 'Ask the AI study buddy a question grounded in course material' })
  chat(@Param('courseId') courseId: string, @Body() dto: ChatDto, @CurrentUser() user: AuthUser) {
    return this.studyService.chat(courseId, dto, user)
  }
}
