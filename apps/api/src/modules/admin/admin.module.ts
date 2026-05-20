import { Module } from '@nestjs/common'
import { UadminController } from './admin.controller'
import { UadminService } from './admin.service'

@Module({
  controllers: [UadminController],
  providers: [UadminService],
  exports: [UadminService],
})
export class UadminModule {}
