import { IsString, IsInt, IsEnum, Min, Max, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { GpaScale } from '@assessiq/types'

export class CreateGpaEntryDto {
  @ApiProperty({ example: '300L First Semester' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  semesterLabel!: string

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
