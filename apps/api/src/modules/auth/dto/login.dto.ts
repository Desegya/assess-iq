import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin@school.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string

  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string
}
