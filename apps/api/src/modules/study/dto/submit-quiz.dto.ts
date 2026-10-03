import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class QuizAnswerDto {
  @ApiProperty()
  @IsString()
  questionId!: string

  @ApiPropertyOptional({ description: 'MCQ/TRUE_FALSE option key, e.g. "A"' })
  @IsString()
  @IsOptional()
  selectedAnswer?: string

  @ApiPropertyOptional({ description: 'Written answer for SHORT_ANSWER/THEORY questions' })
  @IsString()
  @MaxLength(6000)
  @IsOptional()
  textAnswer?: string
}

export class SubmitQuizDto {
  @ApiProperty({ type: [QuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[]
}
