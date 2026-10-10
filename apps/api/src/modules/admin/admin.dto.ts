import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class AdminQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string
  @IsOptional() @IsString() @MaxLength(100) status?: string
  @IsOptional() @IsString() @MaxLength(100) courseId?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20
}
export class AdminStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'INACTIVE']) status!: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string
}
export class AdminAccessDto {
  @IsIn(['ADMIN', 'OWNER', 'NONE']) role!: 'ADMIN' | 'OWNER' | 'NONE'
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string
}
export class AdminReasonDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string
}
export class AdminReportDto extends AdminReasonDto {
  @IsIn(['OPEN', 'RESOLVED', 'DISMISSED']) status!: 'OPEN' | 'RESOLVED' | 'DISMISSED'
}
class LessonSectionDto {
  @IsString() @MinLength(1) @MaxLength(200) heading!: string
  @IsString() @MinLength(1) @MaxLength(20000) body!: string
}
export class AdminLessonDto extends AdminReasonDto {
  @IsString() @MinLength(1) @MaxLength(10000) introduction!: string
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LessonSectionDto)
  sections!: LessonSectionDto[]
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  summary!: string[]
  @IsInt() @Min(1) expectedVersion!: number
}
class QuestionOptionDto {
  @IsIn(['A', 'B', 'C', 'D', 'E', 'F']) key!: string
  @IsString() @MinLength(1) @MaxLength(2000) text!: string
}
export class AdminQuestionDto {
  @IsString() @MaxLength(100) topicId!: string
  @IsString() @MinLength(5) @MaxLength(10000) questionText!: string
  @IsIn(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'THEORY']) questionType!:
    | 'MCQ'
    | 'TRUE_FALSE'
    | 'SHORT_ANSWER'
    | 'THEORY'
  @IsString() @MinLength(1) @MaxLength(10000) correctAnswer!: string
  @IsString() @MaxLength(10000) explanation!: string
  @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty!: 'EASY' | 'MEDIUM' | 'HARD'
  @IsIn(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']) status!:
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'ARCHIVED'
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[]
  @IsOptional() @IsInt() @Min(1) @Max(100) marks?: number
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string
}
