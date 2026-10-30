import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsBoolean,
  IsDateString,
  Matches,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Semester } from '@assessiq/types'

export class CreateCourseDto {
  @ApiPropertyOptional({
    example: '2027-06-15',
    description: 'Optional target exam date; may be set later',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetExamDate?: string | null

  @ApiProperty({ example: 'Biology' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title!: string

  @ApiPropertyOptional({
    example: 'Biology',
    description: 'Defaults to the course title when omitted',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  subject?: string

  @ApiPropertyOptional({ example: 'Senior Secondary Biology — WAEC syllabus' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ example: 'MTH201', description: 'University course code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  courseCode?: string

  @ApiPropertyOptional({ example: 300, description: 'University level (100-600)' })
  @IsInt()
  @Min(100)
  @Max(600)
  @IsOptional()
  level?: number

  @ApiPropertyOptional({ enum: Semester, example: Semester.FIRST })
  @IsEnum(Semester)
  @IsOptional()
  semester?: Semester

  @ApiPropertyOptional({ example: 3, description: 'Credit units (0 for non-credit courses)' })
  @IsInt()
  @Min(0)
  @Max(12)
  @IsOptional()
  creditUnits?: number

  @ApiPropertyOptional({
    example: false,
    description: 'A course from a lower level the student is retaking',
  })
  @IsBoolean()
  @IsOptional()
  isCarryover?: boolean
}
