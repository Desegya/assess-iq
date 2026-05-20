import { Controller } from '@nestjs/common'
import { UanalyticsService } from './analytics.service'

@Controller('analytics')
export class UanalyticsController {
  constructor(private readonly analyticsService: UanalyticsService) {}
}
