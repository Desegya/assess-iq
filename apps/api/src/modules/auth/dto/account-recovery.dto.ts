import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(254)
  email!: string
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  password!: string
}

export class EmailTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string
}
