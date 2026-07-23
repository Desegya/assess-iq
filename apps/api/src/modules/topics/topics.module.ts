import { Module } from '@nestjs/common'
import { TopicsController } from './topics.controller'
import { TopicsService } from './topics.service'
import { CoursesModule } from '../courses/courses.module'

@Module({
  imports: [CoursesModule],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
