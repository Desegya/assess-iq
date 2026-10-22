import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { HealthController } from './health.controller'
import { OperationsController } from './operations.controller'

@Module({
  imports: [AiModule],
  controllers: [HealthController, OperationsController],
  providers: [NightklassAdminGuard],
})
export class OperationsModule {}
