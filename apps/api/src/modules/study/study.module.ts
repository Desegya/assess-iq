import { Module } from '@nestjs/common'
import { StudyController } from './study.controller'
import { StudyService } from './study.service'
import { CoursesModule } from '../courses/courses.module'
import { AiModule } from '../ai/ai.module'
import { TopicsModule } from '../topics/topics.module'

@Module({
  imports: [CoursesModule, AiModule, TopicsModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
