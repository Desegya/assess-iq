import { Controller } from '@nestjs/common'
import { UstudyService } from './study.service'

@Controller('study')
export class UstudyController {
  constructor(private readonly studyService: UstudyService) {}
}
