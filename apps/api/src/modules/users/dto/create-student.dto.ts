import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateStudentDto {
  @ApiProperty({ example: 'Amaka Obi' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({ example: 'amaka@greenfield.edu.ng' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string

  @ApiProperty({ example: 'Student1234', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string
}
