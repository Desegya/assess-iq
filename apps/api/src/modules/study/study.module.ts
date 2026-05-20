import { Module } from '@nestjs/common'
import { UstudyController } from './study.controller'
import { UstudyService } from './study.service'

@Module({
  controllers: [UstudyController],
  providers: [UstudyService],
  exports: [UstudyService],
})
export class UstudyModule {}
