import { Module } from '@nestjs/common'
import { UauthController } from './auth.controller'
import { UauthService } from './auth.service'

@Module({
  controllers: [UauthController],
  providers: [UauthService],
  exports: [UauthService],
})
export class UauthModule {}
