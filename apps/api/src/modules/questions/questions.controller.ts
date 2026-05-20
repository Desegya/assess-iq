import { Controller } from '@nestjs/common'
import { UquestionsService } from './questions.service'

@Controller('questions')
export class UquestionsController {
  constructor(private readonly questionsService: UquestionsService) {}
}
