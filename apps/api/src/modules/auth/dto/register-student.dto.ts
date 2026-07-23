import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RegisterStudentDto {
  @ApiProperty({ example: 'Amaka Obi' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({ example: 'amaka@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string

  @ApiProperty({ example: 'mypassword123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string
}
