import { Type, Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
const NOT_RECORDED = 'Not recorded'

export class MockTemplateDto {
  @IsInt() @Min(2026) @Max(2100) year!: number
  @IsString() @MinLength(5) @MaxLength(150) title!: string
  @IsInt() @Min(1) @Max(240) durationMinutes!: number
  @IsInt() @Min(1) @Max(100) englishCount!: number
  @IsInt() @Min(1) @Max(100) otherCount!: number
  @IsString() @MinLength(20) @MaxLength(10000) instructions!: string
  // Optional: blank notes are recorded as "Not recorded".
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : NOT_RECORDED))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceNote: string = NOT_RECORDED
  @IsIn(['DRAFT', 'APPROVED', 'ARCHIVED']) status!: 'DRAFT' | 'APPROVED' | 'ARCHIVED'
  @IsInt() @Min(0) expectedRevision!: number
}
export class StartMockDto {
  @IsString() @MinLength(1) @MaxLength(100) goalId!: string
  @IsUUID() requestKey!: string
}
class MockAnswerDto {
  @IsString() @MinLength(1) @MaxLength(100) questionId!: string
  @IsString() @MaxLength(6000) answer!: string
}
export class SaveMockDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  selectedQuestions?: string[]
  @IsInt() @Min(1) expectedVersion!: number
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => MockAnswerDto)
  answers!: MockAnswerDto[]
  @IsArray()
  @ArrayMaxSize(400)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  flags!: string[]
}
