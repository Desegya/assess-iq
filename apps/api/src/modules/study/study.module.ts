import { Module } from '@nestjs/common'
import { StudyController } from './study.controller'
import { StudyService } from './study.service'
import { CoursesModule } from '../courses/courses.module'
import { AiModule } from '../ai/ai.module'
import { TopicsModule } from '../topics/topics.module'
import { LearningModule } from '../learning/learning.module'

@Module({
  imports: [CoursesModule, AiModule, TopicsModule, LearningModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
