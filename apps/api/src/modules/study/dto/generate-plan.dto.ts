import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  Min,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator'
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

  @ApiPropertyOptional({
    example: 5,
    description: 'Fixed plan length in weeks (5, 10, 13 or custom); overrides examDate',
  })
  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  weeks?: number

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(14)
  weeklyHours?: number

  @IsOptional()
  @IsIn(['TIMED', 'DAILY'])
  schedulingStyle?: 'TIMED' | 'DAILY'

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  studyDays?: number[]

  @IsOptional()
  @IsIn(['EVENINGS', 'WEEKENDS', 'FLEXIBLE'])
  studyPreference?: 'EVENINGS' | 'WEEKENDS' | 'FLEXIBLE'

  @IsOptional()
  @IsBoolean()
  avoidWorkHours?: boolean

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  workStart?: string

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  workEnd?: string

  @IsOptional()
  @IsTimeZone()
  timeZone?: string
}

export class SetExamDateDto {
  @ApiProperty({ example: '2026-12-10', description: 'Examination date (ISO date string)' })
  @IsDateString()
  examDate!: string
}

export class StudyDayQueryDto {
  @IsOptional()
  @IsTimeZone()
  timeZone?: string
}
