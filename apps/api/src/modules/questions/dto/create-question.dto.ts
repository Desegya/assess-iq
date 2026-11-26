import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { QuestionDifficulty, QuestionType } from '@assessiq/types'

export class QuestionOptionDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  key!: string

  @ApiProperty({ example: 'Chloroplast' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string
}

/** A question written by a teacher (or one row of an imported question paper). */
export class CreateQuestionDto {
  @ApiProperty({ example: 'Where in the cell does photosynthesis take place?' })
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  questionText!: string

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  questionType!: QuestionType

  @ApiPropertyOptional({ type: [QuestionOptionDto], description: 'Required for MCQ (2–8 options)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[]

  @ApiProperty({
    example: 'B',
    description: 'MCQ: the option key. True/False: "True" or "False". Written: the model answer or marking guide.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  correctAnswer!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  explanation?: string

  @ApiProperty({ enum: QuestionDifficulty })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty

  @ApiPropertyOptional({ description: 'Course this question belongs to' })
  @IsOptional()
  @IsString()
  courseId?: string
}

export class BulkCreateQuestionsDto {
  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[]

  @ApiPropertyOptional({ description: 'Applied to every question that does not name its own course' })
  @IsOptional()
  @IsString()
  courseId?: string
}
