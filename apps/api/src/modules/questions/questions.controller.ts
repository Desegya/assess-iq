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
  Query,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { QuestionsService } from './questions.service'
import { GenerateQuestionsDto } from './dto/generate-questions.dto'
import { UpdateQuestionDto } from './dto/update-question.dto'
import { SimulateQuestionsDto } from './dto/simulate-questions.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AuthUser, UserRole } from '@assessiq/types'

@ApiTags('Questions')
@ApiBearerAuth()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  // ─── Generate ─────────────────────────────────────────────────────────────

  @Post('generate')
  @Roles(UserRole.TEACHER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate questions from a document using AI' })
  generate(@Body() dto: GenerateQuestionsDto, @CurrentUser() user: AuthUser) {
    return this.questionsService.generate(dto, user)
  }

  // ─── Simulate (no AI credits needed) ─────────────────────────────────────

  @Post('simulate')
  @Roles(UserRole.TEACHER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Simulate question generation from a pre-built bank (no AI credits required)' })
  simulate(@Body() dto: SimulateQuestionsDto, @CurrentUser() user: AuthUser) {
    return this.questionsService.simulate(dto, user)
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List questions for the current organisation' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'documentId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('courseId') courseId?: string,
    @Query('documentId') documentId?: string,
    @Query('status') status?: string,
  ) {
    return this.questionsService.findAll(user, { courseId, documentId, status })
  }

  // ─── Single ───────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single question' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.questionsService.findOne(id, user)
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a question' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionsService.update(id, dto, user)
  }

  // ─── Approve ──────────────────────────────────────────────────────────────

  @Patch(':id/approve')
  @Roles(UserRole.TEACHER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a question (move from DRAFT → APPROVED)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.questionsService.approve(id, user)
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a question' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.questionsService.remove(id, user)
  }
}
