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
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { ExamFamily } from '@assessiq/types'
const NOT_RECORDED = 'Not recorded'

export class SyllabusObjectiveDto {
  @IsString() @MinLength(1) @MaxLength(60) code!: string
  @IsString() @MinLength(2) @MaxLength(150) title!: string
  @IsString() @MinLength(5) @MaxLength(5000) description!: string
}
export class ExamSyllabusDto {
  @IsOptional() @IsString() @MaxLength(100) id?: string
  @IsEnum(ExamFamily) exam!: ExamFamily
  @IsInt() @Min(2026) @Max(2100) year!: number
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  subject!: string
  @IsInt() @Min(1) @Max(1000) version!: number
  @IsString() @MinLength(5) @MaxLength(150) title!: string
  @IsIn(['OFFICIAL', 'CURATED']) provenance!: 'OFFICIAL' | 'CURATED'
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  sourceUrl?: string
  // Optional: blank notes are recorded as "Not recorded".
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : NOT_RECORDED))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceNote: string = NOT_RECORDED
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => SyllabusObjectiveDto)
  objectives!: SyllabusObjectiveDto[]
  @IsInt() @Min(0) expectedRevision!: number
}
export class SyllabusStateDto {
  @IsIn(['APPROVED', 'ARCHIVED']) status!: 'APPROVED' | 'ARCHIVED'
  @IsInt() @Min(1) expectedRevision!: number
}
export class ObjectiveStudyDto {
  @IsString() @MinLength(1) @MaxLength(100) goalId!: string
  @IsString() @MinLength(1) @MaxLength(100) objectiveId!: string
}
export class ObjectiveMappingDto {
  @IsInt() @Min(1) expectedRevision!: number
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  objectiveIds!: string[]
}
