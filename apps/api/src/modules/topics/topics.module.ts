import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { TopicsController } from './topics.controller'
import { TopicsService } from './topics.service'
import { CoursesModule } from '../courses/courses.module'

@Module({
  imports: [CoursesModule, StorageModule],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
