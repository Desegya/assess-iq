import { AiModule } from '../ai/ai.module'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamContentAdminController, ExamContentLearnerController } from './exam-content.controller'
import { ExamContentService } from './exam-content.service'
import { Module } from '@nestjs/common'
import { ExamPreparationController } from './exam-preparation.controller'
import { ExamPreparationService } from './exam-preparation.service'

@Module({ imports: [AiModule], controllers: [ExamPreparationController, ExamContentAdminController, ExamContentLearnerController], providers: [ExamPreparationService, ExamContentService, NightklassAdminGuard] })
export class ExamPreparationModule {}
