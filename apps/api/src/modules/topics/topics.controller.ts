import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TopicsService } from './topics.service'
import { CreateTopicDto } from './dto/create-topic.dto'
import { UpdateTopicDto } from './dto/update-topic.dto'
import { ReorderTopicsDto } from './dto/reorder-topics.dto'
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
