import { Module } from '@nestjs/common'
import { GpaController } from './gpa.controller'
import { GpaService } from './gpa.service'

@Module({
  controllers: [GpaController],
  providers: [GpaService],
})
export class GpaModule {}
