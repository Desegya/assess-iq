import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamCalendarAdminController, ExamCalendarController } from './exam-calendar.controller'
import { ExamCalendarService } from './exam-calendar.service'
@Module({
  imports: [StorageModule],
  controllers: [ExamCalendarAdminController, ExamCalendarController],
  providers: [ExamCalendarService, NightklassAdminGuard],
  exports: [ExamCalendarService],
})
export class ExamCalendarModule {}
