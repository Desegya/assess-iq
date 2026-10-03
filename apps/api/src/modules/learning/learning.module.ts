import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { CoursesModule } from '../courses/courses.module'
import { LearningController } from './learning.controller'
import { LessonsService } from './lessons.service'
import { ResourcesService } from './resources.service'
import { RetrievalService } from './retrieval.service'

@Module({
  imports: [AiModule, CoursesModule],
  controllers: [LearningController],
  providers: [RetrievalService, LessonsService, ResourcesService],
  exports: [RetrievalService],
})
export class LearningModule {}
