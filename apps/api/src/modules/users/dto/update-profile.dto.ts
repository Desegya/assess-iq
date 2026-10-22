import { ValidateIf, IsString, IsOptional, IsInt, IsEnum, Min, Max, MinLength, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InstitutionType, Semester, StudyPathway, SecondaryStage } from '@assessiq/types'

// Required fields per docs/nightklass/02-onboarding-and-curriculum.md §3; the rest are optional
export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(StudyPathway)
  studyPathway?: StudyPathway

  @ValidateIf(o => o.studyPathway === StudyPathway.EXAM_PREPARATION)
  @IsEnum(SecondaryStage)
  secondaryStage?: SecondaryStage

  @ApiProperty({ example: 'Nigeria' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  country!: string

  @ApiProperty({ enum: InstitutionType, example: InstitutionType.UNIVERSITY })
  @IsEnum(InstitutionType)
  institutionType!: InstitutionType

  @ValidateIf(o => o.studyPathway !== StudyPathway.EXAM_PREPARATION)
  @ApiProperty({ example: 'Animal & Environmental Biology' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  programme!: string

  @ValidateIf(o => o.studyPathway !== StudyPathway.EXAM_PREPARATION)
  @ApiProperty({ example: 200, description: 'Current level (100-600)' })
  @IsInt()
  @Min(100)
  @Max(600)
  currentLevel!: number

  @ValidateIf(o => o.studyPathway !== StudyPathway.EXAM_PREPARATION)
  @ApiProperty({ enum: Semester, example: Semester.FIRST })
  @IsEnum(Semester)
  currentSemester!: Semester

  @ApiPropertyOptional({ example: 'Edo State University' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  institution?: string

  @ApiPropertyOptional({ example: 'Faculty of Science' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  faculty?: string

  @ApiPropertyOptional({ example: '2026/2027' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  academicSession?: string

  @ApiPropertyOptional({ example: 2029 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  graduationYear?: number
}
