import { IsDateString, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class GeneratePlanDto {
  @ApiProperty({ description: 'Course to plan for' })
  @IsString()
  courseId!: string

  @ApiProperty({ example: '2026-10-15', description: 'Examination date (ISO date string)' })
  @IsDateString()
  examDate!: string
}
