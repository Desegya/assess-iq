import { Controller } from '@nestjs/common'
import { UauthService } from './auth.service'

@Controller('auth')
export class UauthController {
  constructor(private readonly authService: UauthService) {}
}
