import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class QuizAnswerDto {
  @ApiProperty()
  @IsString()
  questionId!: string

  @ApiPropertyOptional({ description: 'MCQ/TRUE_FALSE option key, e.g. "A"' })
  @IsString()
  @IsOptional()
  selectedAnswer?: string
}

export class SubmitQuizDto {
  @ApiProperty({ type: [QuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[]
}
