import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TopicsService } from './topics.service'
import { CreateTopicDto } from './dto/create-topic.dto'
import { UpdateTopicDto } from './dto/update-topic.dto'
import { ReorderTopicsDto } from './dto/reorder-topics.dto'
import { BulkCreateTopicsDto } from './dto/bulk-create-topics.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthUser } from '@assessiq/types'

@ApiTags('Topics')
@ApiBearerAuth()
@Controller()
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get('courses/:courseId/topics')
  @ApiOperation({ summary: 'List topics for a course' })
  findAll(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.topicsService.findAll(courseId, user)
  }

  @Post('courses/:courseId/topics')
  @ApiOperation({ summary: 'Add a topic to a course' })
  create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateTopicDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.topicsService.create(courseId, dto, user)
  }

  @Post('courses/:courseId/topics/bulk')
  @ApiOperation({ summary: 'Save a reviewed outline (topics with optional subtopics) in one request' })
  createBulk(
    @Param('courseId') courseId: string,
    @Body() dto: BulkCreateTopicsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.topicsService.createTree(courseId, dto.topics, dto.source, user)
  }

  @Get('courses/:courseId/topics/archived')
  @ApiOperation({ summary: 'List archived topics (removed topics that had study progress)' })
  listArchived(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.topicsService.listArchived(courseId, user)
  }

  @Get('courses/:courseId/outline/revisions')
  @ApiOperation({ summary: 'List outline revision history for a course' })
  listRevisions(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.topicsService.listRevisions(courseId, user)
  }

  @Post('topics/:id/restore')
  @ApiOperation({ summary: 'Restore an archived topic' })
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.topicsService.restore(id, user)
  }

  @Post('courses/:courseId/topics/reorder')
  @ApiOperation({ summary: 'Reorder topics within a course' })
  reorder(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderTopicsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.topicsService.reorder(courseId, dto, user)
  }

  @Patch('topics/:id')
  @ApiOperation({ summary: 'Rename/edit a topic' })
  update(@Param('id') id: string, @Body() dto: UpdateTopicDto, @CurrentUser() user: AuthUser) {
    return this.topicsService.update(id, dto, user)
  }

  @Delete('topics/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a topic' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.topicsService.remove(id, user)
  }
}
