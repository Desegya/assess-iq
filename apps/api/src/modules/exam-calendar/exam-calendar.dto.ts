import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { ExamFamily } from '@assessiq/types'
export class TimetableEntryDto {
  @IsString() @MinLength(2) @MaxLength(100) subject!: string
  @IsString() @MinLength(1) @MaxLength(40) paperCode!: string
  @IsString() @MinLength(2) @MaxLength(150) title!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime?: string
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime?: string
  @IsOptional() @IsString() @MaxLength(500) notes?: string
}
export class ExamCalendarDto {
  @IsOptional() @IsString() @MaxLength(100) id?: string
  @IsEnum(ExamFamily) exam!: ExamFamily
  @IsInt() @Min(2026) @Max(2100) year!: number
  @IsIn(['GENERAL', 'SCHOOL', 'PRIVATE_FIRST', 'PRIVATE_SECOND']) series!: string
  @IsInt() @Min(1) @Max(1000) version!: number
  @IsString() @MinLength(5) @MaxLength(150) title!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string
  @IsString() @MinLength(10) @MaxLength(2000) sourceNote!: string
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TimetableEntryDto)
  entries!: TimetableEntryDto[]
  @IsInt() @Min(0) expectedRevision!: number
}
export class CalendarStateDto {
  @IsIn(['APPROVED', 'ARCHIVED']) status!: 'APPROVED' | 'ARCHIVED'
  @IsInt() @Min(1) expectedRevision!: number
}
export class UploadTimetableDto {
  @Type(() => Number) @IsInt() @Min(1) expectedRevision!: number
}
