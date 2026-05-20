import { Controller } from '@nestjs/common'
import { UattemptsService } from './attempts.service'

@Controller('attempts')
export class UattemptsController {
  constructor(private readonly attemptsService: UattemptsService) {}
}
