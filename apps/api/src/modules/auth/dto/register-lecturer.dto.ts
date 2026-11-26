import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** A lecturer signing up to KwikEval on their own, without a school account. */
export class RegisterLecturerDto {
  @ApiProperty({ example: 'Dr Ama Mensah' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({ example: 'ama.mensah@ug.edu.gh' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(254)
  email!: string

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  password!: string

  @ApiPropertyOptional({ example: 'University of Ghana' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  institution?: string
}
