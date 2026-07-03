import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { AssessmentsService } from './assessments.service'
import { CreateAssessmentDto } from './dto/create-assessment.dto'
import { AddQuestionsDto } from './dto/add-questions.dto'
import { UpdateAssessmentDto } from './dto/update-assessment.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuthUser, UserRole } from '@assessiq/types'

@ApiTags('assessments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  // ─── Teacher / Admin endpoints ────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a new assessment (draft)' })
  create(@Body() dto: CreateAssessmentDto, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.create(dto, user)
  }

  @Get()
  @ApiOperation({ summary: 'List assessments (teacher sees own; admin sees all; student sees published)' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('courseId') courseId?: string,
    @Query('status') status?: string,
  ) {
    // Students see only published assessments
    if (user.role === UserRole.STUDENT) {
      return this.assessmentsService.findPublished(user)
    }
    return this.assessmentsService.findAll(user, { courseId, status })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single assessment with questions' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.findOne(id, user)
  }

  @Post(':id/questions')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Add questions to an assessment' })
  addQuestions(
    @Param('id') id: string,
    @Body() dto: AddQuestionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.addQuestions(id, dto, user)
  }

  @Delete(':id/questions/:questionId')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Remove a question from an assessment' })
  removeQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.removeQuestion(id, questionId, user)
  }

  @Patch(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Update a draft assessment (title, settings, time window, etc.)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.update(id, dto, user)
  }

  @Delete(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Delete a draft assessment with no attempts' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.delete(id, user)
  }

  @Patch(':id/publish')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Publish a draft assessment' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.publish(id, user)
  }

  @Patch(':id/archive')
  @Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Archive an assessment' })
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.archive(id, user)
  }
}
