import { ExamGenerationController } from './exam-generation.controller'
import { ExamGenerationService } from './exam-generation.service'
import { ExamSyllabusService } from './exam-syllabus.service'
import { ExamSyllabusAdminController, ExamSyllabusController } from './exam-syllabus.controller'
import { WaecPaperService } from './waec-paper.service'
import { WaecPaperAdminController, WaecPaperController } from './waec-paper.controller'
import { ExamMockService } from './exam-mock.service'
import { ExamMockController, ExamMockAdminController } from './exam-mock.controller'
import { AiModule } from '../ai/ai.module'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamContentAdminController, ExamContentLearnerController } from './exam-content.controller'
import { ExamContentService } from './exam-content.service'
import { Module } from '@nestjs/common'
import { ExamReportAdminController, ExamReportController, ExamReportService } from './exam-reports'
import { ExamAccessStatusController, ExamPreparationController } from './exam-preparation.controller'
import { ExamPreparationService } from './exam-preparation.service'

@Module({
  imports: [AiModule],
  controllers: [
    ExamGenerationController,
    ExamSyllabusAdminController,
    ExamSyllabusController,
    WaecPaperAdminController,
    WaecPaperController,
    ExamPreparationController,
    ExamAccessStatusController,
    ExamContentAdminController,
    ExamContentLearnerController,
    ExamMockController,
    ExamMockAdminController,
    ExamReportController,
    ExamReportAdminController,
  ],
  providers: [
    ExamGenerationService,
    ExamSyllabusService,
    WaecPaperService,
    ExamPreparationService,
    ExamContentService,
    ExamMockService,
    ExamReportService,
    NightklassAdminGuard,
  ],
})
export class ExamPreparationModule {}
