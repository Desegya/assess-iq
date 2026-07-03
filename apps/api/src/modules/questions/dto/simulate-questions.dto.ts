import { IsString, IsInt, IsArray, IsEnum, IsOptional, Min, Max, MinLength, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { QuestionType, QuestionDifficulty } from '@assessiq/types'

export class SimulateQuestionsDto {
  @ApiProperty({ example: 'Photosynthesis', description: 'Topic or concept to generate questions about' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  topic!: string

  @ApiPropertyOptional({ example: 'Biology', description: 'Subject area (helps with matching)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string

  @ApiProperty({ enum: QuestionType, isArray: true })
  @IsArray()
  @IsEnum(QuestionType, { each: true })
  types!: QuestionType[]

  @ApiProperty({ example: 10, minimum: 1, maximum: 30 })
  @IsInt()
  @Min(1)
  @Max(30)
  count!: number

  @ApiProperty({ enum: QuestionDifficulty })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty

  @ApiPropertyOptional({ description: 'Link generated questions to a course' })
  @IsOptional()
  @IsString()
  courseId?: string
}
