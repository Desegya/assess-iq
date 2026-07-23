import { IsEnum, IsInt, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { QuestionDifficulty } from '@assessiq/types'

export class GenerateQuizDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  count!: number

  @ApiProperty({ enum: QuestionDifficulty, example: QuestionDifficulty.MEDIUM })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty
}
