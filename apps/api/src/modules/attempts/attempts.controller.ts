import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { AttemptsService } from './attempts.service'
import { StartAttemptDto } from './dto/start-attempt.dto'
import { SubmitAnswerDto } from './dto/submit-answer.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuthUser, UserRole } from '@assessiq/types'

@ApiTags('attempts')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  // POST /attempts — student starts (or resumes) an attempt
  @Post()
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Start or resume an assessment attempt' })
  start(@Body() dto: StartAttemptDto, @CurrentUser() user: AuthUser) {
    return this.attemptsService.start(dto, user)
  }

  // GET /attempts/my — student's own attempt history
  @Get('my')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List my attempts' })
  myAttempts(@CurrentUser() user: AuthUser) {
    return this.attemptsService.findMyAttempts(user)
  }

  // GET /attempts?assessmentId=xxx — teacher sees all attempts for an assessment
  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'List all attempts for an assessment (teacher/admin)' })
  @ApiQuery({ name: 'assessmentId', required: true })
  findByAssessment(
    @Query('assessmentId') assessmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attemptsService.findByAssessment(assessmentId, user)
  }

  // GET /attempts/:id — get attempt details
  @Get(':id')
  @ApiOperation({ summary: 'Get attempt by ID (with answers)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attemptsService.findOne(id, user)
  }

  // POST /attempts/:id/answers — save / update an answer
  @Post(':id/answers')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Save an answer for a question in this attempt' })
  saveAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attemptsService.saveAnswer(id, dto, user)
  }

  // POST /attempts/:id/submit — finalize the attempt
  @Post(':id/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit attempt and get score' })
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attemptsService.submit(id, user)
  }
}
