import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateCourseDto {
  @ApiProperty({ example: 'Biology' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title!: string

  @ApiProperty({ example: 'Biology' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  subject!: string

  @ApiPropertyOptional({ example: 'Senior Secondary Biology — WAEC syllabus' })
  @IsString()
  @IsOptional()
  description?: string
}
