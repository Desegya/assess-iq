import { Global, Module } from '@nestjs/common'
import { RuntimeSettingsService } from './runtime-settings.service'
import { ExamAccessGuard, ExamAccessService } from './exam-access'

// No imports: lower-level modules (AI quotas, exam services) depend on these.
@Global()
@Module({
  providers: [RuntimeSettingsService, ExamAccessService, ExamAccessGuard],
  exports: [RuntimeSettingsService, ExamAccessService, ExamAccessGuard],
})
export class RuntimeSettingsModule {}
