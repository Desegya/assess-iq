import { IsArray, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { QuestionDifficulty, QuestionType } from '@assessiq/types'

export class GenerateQuizDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  count!: number

  @ApiProperty({ enum: QuestionDifficulty, example: QuestionDifficulty.MEDIUM })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty

  @ApiPropertyOptional({
    enum: QuestionType,
    isArray: true,
    description: 'Question types to include; defaults to MCQ + TRUE_FALSE. THEORY = structured/essay, SHORT_ANSWER includes calculations',
  })
  @IsArray()
  @IsEnum(QuestionType, { each: true })
  @IsOptional()
  types?: QuestionType[]
}
