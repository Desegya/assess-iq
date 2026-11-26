import { IsBoolean, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

/** When and how much of their result students see. Changeable at any time, even after publishing. */
export class ResultSettingsDto {
  @ApiPropertyOptional({ description: 'Show results as soon as each student submits' })
  @IsOptional()
  @IsBoolean()
  showResultsImmediately?: boolean

  @ApiPropertyOptional({ description: 'Release (true) or withhold (false) results now' })
  @IsOptional()
  @IsBoolean()
  released?: boolean

  @ApiPropertyOptional({ description: 'Also show which questions were right or wrong, with corrections' })
  @IsOptional()
  @IsBoolean()
  allowReview?: boolean
}
