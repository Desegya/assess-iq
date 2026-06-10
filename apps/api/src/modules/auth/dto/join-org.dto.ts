import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class JoinOrgDto {
  @ApiProperty({ example: 'Amaka Obi' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({ example: 'amaka@greenfield.edu.ng' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 'mypassword123' })
  @IsString()
  @MinLength(8)
  password!: string

  @ApiProperty({ example: 'K7M2-X9P4' })
  @IsString()
  @MinLength(4)
  joinCode!: string
}
