import { IsString, IsInt, IsArray, IsEnum, IsOptional, Min, Max } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { QuestionType, QuestionDifficulty } from '@assessiq/types'

export class GenerateQuestionsDto {
  @ApiProperty({ description: 'ID of the READY document to generate questions from' })
  @IsString()
  documentId!: string

  @ApiProperty({
    enum: QuestionType,
    isArray: true,
    example: [QuestionType.MCQ, QuestionType.TRUE_FALSE],
  })
  @IsArray()
  @IsEnum(QuestionType, { each: true })
  types!: QuestionType[]

  @ApiProperty({ example: 10, minimum: 1, maximum: 30 })
  @IsInt()
  @Min(1)
  @Max(30)
  count!: number

  @ApiProperty({ enum: QuestionDifficulty, example: QuestionDifficulty.MEDIUM })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty

  @ApiPropertyOptional({ example: 'Photosynthesis' })
  @IsString()
  @IsOptional()
  topicHint?: string
}
