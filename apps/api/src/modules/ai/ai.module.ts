import { Module } from '@nestjs/common'
import { UaiController } from './ai.controller'
import { UaiService } from './ai.service'

@Module({
  controllers: [UaiController],
  providers: [UaiService],
  exports: [UaiService],
})
export class UaiModule {}
