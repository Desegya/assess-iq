import { IsString, IsInt, IsEnum, Min, Max, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { GpaScale, Semester } from '@assessiq/types'

export class CreateGpaEntryDto {
  @ApiProperty({ example: 300, description: 'University level (100-600)' })
  @IsInt()
  @Min(100)
  @Max(600)
  level!: number

  @ApiProperty({ enum: Semester, example: Semester.FIRST })
  @IsEnum(Semester)
  semester!: Semester

  @ApiProperty({ example: 'Data Structures & Algorithms' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  courseTitle!: string

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(12)
  creditUnits!: number

  @ApiProperty({ example: 'A' })
  @IsString()
  @MaxLength(2)
  grade!: string

  @ApiProperty({ enum: GpaScale, example: GpaScale.FIVE })
  @IsEnum(GpaScale)
  scale!: GpaScale
}
