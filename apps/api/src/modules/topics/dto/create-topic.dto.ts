import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TopicSource } from '@assessiq/types'

export class CreateTopicDto {
  @ApiProperty({ example: 'Descriptive Statistics' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional({ example: 'Mean, median, mode, range, variance, standard deviation' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ description: 'Parent topic id, for sub-topics' })
  @IsString()
  @IsOptional()
  parentTopicId?: string

  @ApiPropertyOptional({ example: 45, description: 'Estimated minutes to study this topic' })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number

  @ApiPropertyOptional({ enum: TopicSource, description: 'Outline layer; defaults to STUDENT' })
  @IsEnum(TopicSource)
  @IsOptional()
  source?: TopicSource
}
