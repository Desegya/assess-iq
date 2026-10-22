import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GeneratePlanDto {
  @IsOptional() @IsString() goalId?: string
  @ApiProperty({ description: 'Course to plan for' })
  @IsString()
  courseId!: string

  @ApiPropertyOptional({ example: '2026-10-15', description: 'Examination date (ISO date string)' })
  @IsDateString()
  @IsOptional()
  examDate?: string

  @ApiPropertyOptional({ example: 5, description: 'Fixed plan length in weeks (5, 10, 13 or custom); overrides examDate' })
  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  weeks?: number
}

export class SetExamDateDto {
  @ApiProperty({ example: '2026-12-10', description: 'Examination date (ISO date string)' })
  @IsDateString()
  examDate!: string
}
