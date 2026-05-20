import { Controller } from '@nestjs/common'
import { UassessmentsService } from './assessments.service'

@Controller('assessments')
export class UassessmentsController {
  constructor(private readonly assessmentsService: UassessmentsService) {}
}
