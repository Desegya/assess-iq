import { Module } from '@nestjs/common'
import { UassessmentsController } from './assessments.controller'
import { UassessmentsService } from './assessments.service'

@Module({
  controllers: [UassessmentsController],
  providers: [UassessmentsService],
  exports: [UassessmentsService],
})
export class UassessmentsModule {}
