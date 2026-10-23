import { Type, Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
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
import { ExamFamily, QuestionDifficulty, QuestionType } from '@assessiq/types'

const NOT_RECORDED = 'Not recorded'

export class ContentFilterDto {
  @IsOptional() @IsEnum(ExamFamily) exam?: ExamFamily
  @IsOptional() @IsString() @MaxLength(100) subject?: string
  @IsOptional() @IsString() @MaxLength(150) topic?: string
  @IsOptional() @IsIn(['DRAFT', 'APPROVED', 'ARCHIVED']) status?: 'DRAFT' | 'APPROVED' | 'ARCHIVED'
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1
}
export class ContentScopeDto {
  @IsEnum(ExamFamily) exam!: ExamFamily
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  subject!: string
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  topic!: string
}
export class CreateExamMaterialDto extends ContentScopeDto {
  @IsString() @MinLength(2) @MaxLength(150) title!: string
  @IsString() @MinLength(20) @MaxLength(50000) body!: string
  // Optional: blank notes are recorded as "Not recorded".
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : NOT_RECORDED))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceNote: string = NOT_RECORDED
}
export class UploadExamMaterialDto extends ContentScopeDto {
  @IsString() @MinLength(2) @MaxLength(150) title!: string
  // Optional: blank notes are recorded as "Not recorded".
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : NOT_RECORDED))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceNote: string = NOT_RECORDED
}
/** Only exam and subject are required: without a topic the AI covers the syllabus broadly. */
export class GenerateBankDto {
  @IsEnum(ExamFamily) exam!: ExamFamily
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  subject!: string
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  topic?: string
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  objectiveIds?: string[]
  @IsOptional() @IsString() @MaxLength(100) materialId?: string
  @IsInt() @Min(1) @Max(10) count = 5
  @IsEnum(QuestionDifficulty) difficulty: QuestionDifficulty = QuestionDifficulty.MEDIUM
  @IsEnum(QuestionType) questionType: QuestionType = QuestionType.MCQ
}
class BankOptionDto {
  @IsIn(['A', 'B', 'C', 'D', 'E', 'F']) key!: string
  @IsString() @MinLength(1) @MaxLength(2000) text!: string
}
export class BankQuestionDto extends ContentScopeDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  objectiveIds?: string[]
  @IsString() @MinLength(5) @MaxLength(10000) questionText!: string
  @IsEnum(QuestionType) questionType!: QuestionType
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => BankOptionDto)
  options?: BankOptionDto[]
  @IsString() @MinLength(1) @MaxLength(10000) correctAnswer!: string
  @IsString() @MinLength(5) @MaxLength(10000) explanation!: string
  @IsInt() @Min(1) @Max(100) marks = 1
  @IsEnum(QuestionDifficulty) difficulty: QuestionDifficulty = QuestionDifficulty.MEDIUM
}
export class EditBankQuestionDto extends BankQuestionDto {
  @IsInt() @Min(1) expectedRevision!: number
}
export class BankStateDto {
  @IsIn(['APPROVED', 'ARCHIVED']) status!: 'APPROVED' | 'ARCHIVED'
  @IsInt() @Min(1) expectedRevision!: number
}
export class MaterialStateDto {
  @IsIn(['APPROVED', 'ARCHIVED']) status!: 'APPROVED' | 'ARCHIVED'
}
export class BankPracticeDto {
  @IsOptional() @IsString() @MaxLength(100) objectiveId?: string
  @IsString() @MinLength(1) @MaxLength(100) goalId!: string
  @IsString() @MinLength(2) @MaxLength(100) subjectKey!: string
  @IsOptional() @IsString() @MaxLength(150) topic?: string
  @IsInt() @Min(1) @Max(20) count = 10
}

export class BulkBankStateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  ids!: string[]
  @IsIn(['APPROVED', 'ARCHIVED']) status!: 'APPROVED' | 'ARCHIVED'
}
