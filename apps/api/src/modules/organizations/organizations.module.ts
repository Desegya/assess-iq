import { Module } from '@nestjs/common'
import { UorganizationsController } from './organizations.controller'
import { UorganizationsService } from './organizations.service'

@Module({
  controllers: [UorganizationsController],
  providers: [UorganizationsService],
  exports: [UorganizationsService],
})
export class UorganizationsModule {}
