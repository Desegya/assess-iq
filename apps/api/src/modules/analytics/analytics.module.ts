import { Module } from '@nestjs/common'
import { UanalyticsController } from './analytics.controller'
import { UanalyticsService } from './analytics.service'

@Module({
  controllers: [UanalyticsController],
  providers: [UanalyticsService],
  exports: [UanalyticsService],
})
export class UanalyticsModule {}
