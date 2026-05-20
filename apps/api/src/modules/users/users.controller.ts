import { Controller } from '@nestjs/common'
import { UusersService } from './users.service'

@Controller('users')
export class UusersController {
  constructor(private readonly usersService: UusersService) {}
}
