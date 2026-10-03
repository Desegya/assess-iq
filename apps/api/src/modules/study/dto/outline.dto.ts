import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OutlineTextDto {
  @ApiProperty({ example: 'Week 1: Introduction to biostatistics…' })
  @IsString()
  @MinLength(20, { message: 'Paste a bit more of the outline so we can find the topics' })
  @MaxLength(30000)
  text!: string
}

export class ExpandOutlineDto {
  @ApiPropertyOptional({ description: 'Expand only this topic; omit to expand every topic without subtopics' })
  @IsString()
  @IsOptional()
  topicId?: string
}
