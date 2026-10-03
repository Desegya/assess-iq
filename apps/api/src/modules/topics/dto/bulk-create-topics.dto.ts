import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TopicSource } from '@assessiq/types'

export class OutlineSubtopicDto {
  @ApiProperty({ example: 'Mean, median and mode' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string
}

export class OutlineTopicDto extends OutlineSubtopicDto {
  @ApiPropertyOptional({ type: [OutlineSubtopicDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OutlineSubtopicDto)
  @IsOptional()
  subtopics?: OutlineSubtopicDto[]
}

// Saves a reviewed outline (topics + subtopics) in one go
export class BulkCreateTopicsDto {
  @ApiProperty({ enum: TopicSource })
  @IsEnum(TopicSource)
  source!: TopicSource

  @ApiProperty({ type: [OutlineTopicDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => OutlineTopicDto)
  topics!: OutlineTopicDto[]
}
