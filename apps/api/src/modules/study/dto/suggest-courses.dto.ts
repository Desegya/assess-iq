import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Semester } from '@assessiq/types'

// Both default to the student's profile; override to browse another level/semester (e.g. carryovers)
export class SuggestCoursesDto {
  @ApiPropertyOptional({ example: 200 })
  @IsInt()
  @Min(100)
  @Max(600)
  @IsOptional()
  level?: number

  @ApiPropertyOptional({ enum: Semester })
  @IsEnum(Semester)
  @IsOptional()
  semester?: Semester
}
