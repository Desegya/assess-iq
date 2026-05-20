import { Controller } from '@nestjs/common'
import { UaiService } from './ai.service'

@Controller('ai')
export class UaiController {
  constructor(private readonly aiService: UaiService) {}
}
