import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthUser } from '@assessiq/types'
import { LessonsService } from './lessons.service'
import { ResourcesService } from './resources.service'
import { RetrievalService } from './retrieval.service'
import { GenerateLessonDto, ReportLessonDto } from './dto/lesson.dto'

@ApiTags('Learning')
@ApiBearerAuth()
@Controller('learning')
export class LearningController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly resources: ResourcesService,
    private readonly retrieval: RetrievalService,
  ) {}

  @Get('topics/:topicId/lesson')
  @ApiOperation({ summary: 'Get the latest lesson for a topic, plus its version history' })
  getLesson(@Param('topicId') topicId: string, @CurrentUser() user: AuthUser) {
    return this.lessons.getCurrent(topicId, user)
  }

  @Post('topics/:topicId/lesson/generate')
  @ApiOperation({ summary: 'Generate a new lesson version (from your material, AI, or both)' })
  generateLesson(@Param('topicId') topicId: string, @Body() dto: GenerateLessonDto, @CurrentUser() user: AuthUser) {
    return this.lessons.generate(topicId, dto, user)
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Get a specific lesson version' })
  getLessonVersion(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lessons.getVersion(id, user)
  }

  @Post('lessons/:id/report')
  @ApiOperation({ summary: 'Report inaccurate lesson content' })
  reportLesson(@Param('id') id: string, @Body() dto: ReportLessonDto, @CurrentUser() user: AuthUser) {
    return this.lessons.report(id, dto.reason, user)
  }

  @Get('topics/:topicId/resources')
  @ApiQuery({ name: 'refresh', required: false })
  @ApiOperation({ summary: 'Recommended videos and supplementary resources for a topic' })
  getResources(@Param('topicId') topicId: string, @CurrentUser() user: AuthUser, @Query('refresh') refresh?: string) {
    return this.resources.getForTopic(topicId, user, refresh === '1' || refresh === 'true')
  }

  @Post('documents/:id/map')
  @ApiOperation({ summary: 'Map an uploaded document onto the course outline and find topics it adds' })
  mapDocument(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.retrieval.mapDocument(id, user)
  }
}
