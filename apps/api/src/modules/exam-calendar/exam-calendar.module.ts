import { AiModule } from '../ai/ai.module'
import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamCalendarAdminController, ExamCalendarController } from './exam-calendar.controller'
import { ExamCalendarService } from './exam-calendar.service'
@Module({
  imports: [StorageModule, AiModule],
  controllers: [ExamCalendarAdminController, ExamCalendarController],
  providers: [ExamCalendarService, NightklassAdminGuard],
  exports: [ExamCalendarService],
})
export class ExamCalendarModule {}
