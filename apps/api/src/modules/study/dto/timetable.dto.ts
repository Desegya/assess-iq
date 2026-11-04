import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class TimetableCourseDto {
  @IsString() courseId!: string
  @IsOptional() @IsInt() @Min(1) @Max(5) difficulty?: number
}

export class TimetableDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique((item: TimetableCourseDto) => item.courseId)
  @ValidateNested({ each: true })
  @Type(() => TimetableCourseDto)
  courses!: TimetableCourseDto[]

  @IsIn(['DAILY', 'TIMED']) schedulingStyle!: 'DAILY' | 'TIMED'
  @IsNumber() @Min(0.5) @Max(21) weeklyHours!: number
  @IsInt() @Min(1) @Max(6) maxCoursesPerDay!: number
  @IsInt() @Min(30) @Max(180) dailyMinutes!: number
  @IsInt() @Min(1) @Max(52) weeks!: number
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  studyDays!: number[]
  @IsTimeZone() timeZone!: string
  @IsBoolean() autoAdjust!: boolean
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime?: string
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime?: string
}
