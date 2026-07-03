import {
  IsString,
  IsOptional,
  IsInt,
  IsISO8601,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateAssessmentSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() shuffleQuestions?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() shuffleOptions?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showResultsImmediately?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowReview?: boolean
  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional() @IsInt() @Min(1) @Max(10) maxAttempts?: number
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional({ example: 'Biology Mid-Term Test' })
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) instructions?: string

  @ApiPropertyOptional({ minimum: 5, maximum: 480 })
  @IsOptional() @IsInt() @Min(5) @Max(480) durationMinutes?: number

  @ApiPropertyOptional() @IsOptional() @IsISO8601() startTime?: string

  @ApiPropertyOptional() @IsOptional() @IsISO8601() endTime?: string

  @ApiPropertyOptional({ type: () => UpdateAssessmentSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAssessmentSettingsDto)
  settings?: UpdateAssessmentSettingsDto
}
