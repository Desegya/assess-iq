import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import { ExamFamily } from '@assessiq/types'

export class SaveExamGoalDto {
  @IsEnum(ExamFamily)
  exam!: ExamFamily

  @IsInt()
  @Min(2026)
  @Max(2100)
  year!: number

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(100, { each: true })
  subjects!: string[]
}
