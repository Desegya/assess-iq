import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { CoursesModule } from '../courses/courses.module'
import { LearningController } from './learning.controller'
import { LessonsService } from './lessons.service'
import { ResourcesService } from './resources.service'
import { RetrievalService } from './retrieval.service'
import { StorageModule } from '../storage/storage.module'
import { LessonVisualsService } from './lesson-visuals.service'
import { LessonIllustrationsService } from './lesson-illustrations.service'

@Module({
  imports: [AiModule, CoursesModule, StorageModule],
  controllers: [LearningController],
  providers: [RetrievalService, LessonsService, ResourcesService, LessonVisualsService, LessonIllustrationsService],
  exports: [RetrievalService, LessonVisualsService],
})
export class LearningModule {}
