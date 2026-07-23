import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateTopicDto {
  @ApiPropertyOptional({ example: 'Descriptive Statistics' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  name?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number

  @ApiPropertyOptional({ example: 45 })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number

  @ApiPropertyOptional({ example: 0.7 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  importanceWeight?: number
}
