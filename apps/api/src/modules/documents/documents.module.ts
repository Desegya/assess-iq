import { Module } from '@nestjs/common'
import { UdocumentsController } from './documents.controller'
import { UdocumentsService } from './documents.service'

@Module({
  controllers: [UdocumentsController],
  providers: [UdocumentsService],
  exports: [UdocumentsService],
})
export class UdocumentsModule {}
