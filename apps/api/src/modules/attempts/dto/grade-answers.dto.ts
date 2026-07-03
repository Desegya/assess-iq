import { IsArray, IsString, IsNumber, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class GradeItemDto {
  @ApiProperty({ description: 'ID of the Answer record to grade' })
  @IsString()
  answerId!: string

  @ApiProperty({ description: 'Score assigned (0 = incorrect, 1 = correct)', minimum: 0 })
  @IsNumber()
  @Min(0)
  score!: number
}

export class GradeAnswersDto {
  @ApiProperty({ type: [GradeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeItemDto)
  grades!: GradeItemDto[]
}
