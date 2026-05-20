import { Controller } from '@nestjs/common'
import { UdocumentsService } from './documents.service'

@Controller('documents')
export class UdocumentsController {
  constructor(private readonly documentsService: UdocumentsService) {}
}
