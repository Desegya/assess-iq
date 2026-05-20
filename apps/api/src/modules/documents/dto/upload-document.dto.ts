import { IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UploadDocumentDto {
  @ApiPropertyOptional({ description: 'Associate this document with an existing course' })
  @IsString()
  @IsOptional()
  courseId?: string
}
