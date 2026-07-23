import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class CompleteSessionDto {
  @ApiPropertyOptional({ example: 4, description: '1 (do not understand) .. 5 (can explain to someone else)' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  confidenceRating?: number

  @ApiPropertyOptional({ example: 40 })
  @IsInt()
  @Min(0)
  @IsOptional()
  actualMinutes?: number
}
