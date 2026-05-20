import { Controller } from '@nestjs/common'
import { UadminService } from './admin.service'

@Controller('admin')
export class UadminController {
  constructor(private readonly adminService: UadminService) {}
}
