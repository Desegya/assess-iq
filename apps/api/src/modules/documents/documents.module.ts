import { Module } from '@nestjs/common'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { StorageModule } from '../storage/storage.module'
import { AiModule } from '../ai/ai.module'
import { LearningModule } from '../learning/learning.module'

@Module({
  imports: [StorageModule, AiModule, LearningModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
