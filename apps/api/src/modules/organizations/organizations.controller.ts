import { Controller } from '@nestjs/common'
import { UorganizationsService } from './organizations.service'

@Controller('organizations')
export class UorganizationsController {
  constructor(private readonly organizationsService: UorganizationsService) {}
}
