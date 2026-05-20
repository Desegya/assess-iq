import { IsString, IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { QuestionDifficulty, QuestionStatus } from '@assessiq/types'

class OptionDto {
  @IsString() key!: string
  @IsString() text!: string
}

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  questionText?: string

  @ApiPropertyOptional({ type: [OptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  @IsOptional()
  options?: OptionDto[]

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  correctAnswer?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  explanation?: string

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty

  @ApiPropertyOptional({ enum: QuestionStatus })
  @IsEnum(QuestionStatus)
  @IsOptional()
  status?: QuestionStatus
}
