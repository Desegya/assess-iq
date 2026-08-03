import { IsInt, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class GenerateFlashcardsDto {
  @ApiProperty({ example: 8, minimum: 1, maximum: 30 })
  @IsInt()
  @Min(1)
  @Max(30)
  count!: number
}
