import { Module } from '@nestjs/common'
import { ExamPreparationController } from './exam-preparation.controller'
import { ExamPreparationService } from './exam-preparation.service'

@Module({ controllers: [ExamPreparationController], providers: [ExamPreparationService] })
export class ExamPreparationModule {}
