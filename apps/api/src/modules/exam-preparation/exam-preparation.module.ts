import { ExamMockService } from './exam-mock.service'
import { ExamMockController, ExamMockAdminController } from './exam-mock.controller'
import { AiModule } from '../ai/ai.module'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamContentAdminController, ExamContentLearnerController } from './exam-content.controller'
import { ExamContentService } from './exam-content.service'
import { Module } from '@nestjs/common'
import { ExamPreparationController } from './exam-preparation.controller'
import { ExamPreparationService } from './exam-preparation.service'

@Module({ imports: [AiModule], controllers: [ExamPreparationController, ExamContentAdminController, ExamContentLearnerController, ExamMockController, ExamMockAdminController], providers: [ExamPreparationService, ExamContentService, ExamMockService, NightklassAdminGuard] })
export class ExamPreparationModule {}
