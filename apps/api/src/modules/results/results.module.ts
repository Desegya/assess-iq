import { Module } from '@nestjs/common'
import { ResultsController } from './results.controller'
import { ResultsExportService } from './results-export.service'

@Module({ controllers: [ResultsController], providers: [ResultsExportService] })
export class ResultsModule {}
