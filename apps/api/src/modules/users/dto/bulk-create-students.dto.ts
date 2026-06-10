import { IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class BulkStudentRowDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string
}

export class BulkCreateStudentsDto {
  @ApiProperty({ type: [BulkStudentRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStudentRowDto)
  students!: BulkStudentRowDto[]
}
