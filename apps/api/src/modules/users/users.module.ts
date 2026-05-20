import { Module } from '@nestjs/common'
import { UusersController } from './users.controller'
import { UusersService } from './users.service'

@Module({
  controllers: [UusersController],
  providers: [UusersService],
  exports: [UusersService],
})
export class UusersModule {}
