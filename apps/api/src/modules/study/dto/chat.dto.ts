import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ChatHistoryMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  content!: string
}

export class ChatDto {
  @ApiProperty({ example: 'Can you explain standard deviation simply?' })
  @IsString()
  @MaxLength(2000)
  message!: string

  @ApiPropertyOptional({ type: [ChatHistoryMessageDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  @IsOptional()
  history?: ChatHistoryMessageDto[]

  @IsOptional()
  @IsString()
  @MaxLength(128)
  topicId?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  lessonId?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  documentId?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selectedText?: string
}
