import { WaecPaperService } from './waec-paper.service'
import { WaecPaperAdminController, WaecPaperController } from './waec-paper.controller'
import { ExamMockService } from './exam-mock.service'
import { ExamMockController, ExamMockAdminController } from './exam-mock.controller'
import { AiModule } from '../ai/ai.module'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamContentAdminController, ExamContentLearnerController } from './exam-content.controller'
import { ExamContentService } from './exam-content.service'
import { Module } from '@nestjs/common'
import { ExamPreparationController } from './exam-preparation.controller'
import { ExamPreparationService } from './exam-preparation.service'

@Module({
  imports: [AiModule],
  controllers: [
    WaecPaperAdminController,
    WaecPaperController,
    ExamPreparationController,
    ExamContentAdminController,
    ExamContentLearnerController,
    ExamMockController,
    ExamMockAdminController,
  ],
  providers: [
    WaecPaperService,
    ExamPreparationService,
    ExamContentService,
    ExamMockService,
    NightklassAdminGuard,
  ],
})
export class ExamPreparationModule {}
