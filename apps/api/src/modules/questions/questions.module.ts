import { Module } from '@nestjs/common'
import { UquestionsController } from './questions.controller'
import { UquestionsService } from './questions.service'

@Module({
  controllers: [UquestionsController],
  providers: [UquestionsService],
  exports: [UquestionsService],
})
export class UquestionsModule {}
