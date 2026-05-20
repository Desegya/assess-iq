import { IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class StartAttemptDto {
  @ApiProperty({ example: 'cldAssessmentId' })
  @IsString()
  assessmentId!: string
}
