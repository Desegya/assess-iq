import {
  IsString,
  IsOptional,
  IsInt,
  IsISO8601,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateAssessmentDto {
  @ApiProperty({ example: 'Biology Mid-Term Test' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string

  @ApiProperty({ example: 'Mid-term assessment covering chapters 1–5', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiProperty({ example: 'Answer all questions. No calculators allowed.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string

  @ApiProperty({ example: 'cld123courseId' })
  @IsString()
  courseId!: string

  @ApiProperty({ example: 60, description: 'Time limit in minutes' })
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number

  @ApiProperty({ example: '2025-06-01T08:00:00Z', required: false })
  @IsOptional()
  @IsISO8601()
  startTime?: string

  @ApiProperty({ example: '2025-06-01T10:00:00Z', required: false })
  @IsOptional()
  @IsISO8601()
  endTime?: string
}
