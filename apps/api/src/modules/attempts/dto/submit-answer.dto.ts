import { IsString, IsOptional, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SubmitAnswerDto {
  @ApiProperty({ example: 'cldQuestionId' })
  @IsString()
  questionId!: string

  @ApiProperty({ example: 'A', description: 'MCQ / True-False option key', required: false })
  @IsOptional()
  @IsString()
  selectedAnswer?: string

  @ApiProperty({ example: 'Photosynthesis is...', description: 'Short answer / theory text', required: false })
  @IsOptional()
  @IsString()
  textAnswer?: string

  @ApiProperty({ example: 45, description: 'Seconds spent on this question', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeTakenSeconds?: number
}
