import { Type, Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
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

export class WaecSectionDto {
  @IsString() @MinLength(1) @MaxLength(50) id!: string
  @IsString() @MinLength(2) @MaxLength(150) title!: string
  @IsIn(['MCQ', 'SHORT_ANSWER', 'THEORY']) questionType!: 'MCQ' | 'SHORT_ANSWER' | 'THEORY'
  @IsInt() @Min(1) @Max(100) count!: number
  @IsInt() @Min(1) @Max(100) choose!: number
  @IsInt() @Min(1) @Max(100) marks!: number
  @IsOptional() @IsString() @MaxLength(150) topic?: string
}
export class WaecPaperDto {
  @IsOptional() @IsString() @MaxLength(100) id?: string
  @IsInt() @Min(2026) @Max(2100) year!: number
  @IsIn(['SCHOOL', 'PRIVATE_FIRST', 'PRIVATE_SECOND']) series!: string
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  subject!: string
  @IsString() @MinLength(1) @MaxLength(40) paperCode!: string
  @IsString() @MinLength(5) @MaxLength(150) title!: string
  @IsInt() @Min(1) @Max(300) durationMinutes!: number
  @IsString() @MinLength(20) @MaxLength(10000) instructions!: string
  // Optional: blank notes are recorded as "Not recorded".
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : NOT_RECORDED))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceNote: string = NOT_RECORDED
  @IsIn(['DRAFT', 'APPROVED', 'ARCHIVED']) status!: 'DRAFT' | 'APPROVED' | 'ARCHIVED'
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WaecSectionDto)
  sections!: WaecSectionDto[]
  @IsInt() @Min(0) expectedRevision!: number
}
export class StartWaecPaperDto {
  @IsString() @MinLength(1) @MaxLength(100) goalId!: string
  @IsString() @MinLength(1) @MaxLength(100) paperId!: string
  @IsUUID() requestKey!: string
}
