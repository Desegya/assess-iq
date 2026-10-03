import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GenerateLessonDto {
  @ApiPropertyOptional({
    enum: ['COMBINED', 'MATERIAL', 'AI'],
    description: 'MATERIAL = only your uploads; AI = no uploads; COMBINED (default) = uploads plus AI to fill gaps',
  })
  @IsIn(['COMBINED', 'MATERIAL', 'AI'])
  @IsOptional()
  mode?: 'COMBINED' | 'MATERIAL' | 'AI'

  @ApiPropertyOptional({ description: 'What was wrong with the previous version; fed into the regeneration' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  feedback?: string
}

export class ReportLessonDto {
  @ApiProperty({ example: 'The formula for variance is wrong in section 2' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string
}
