import { IsIn, IsOptional, IsEmail, IsString, MaxLength, MinLength } from 'class-validator'
import { PRODUCT_APPS, ProductApp } from '../../email/email.service'

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(254)
  email!: string

  /** Which product's links and name to use in emails. Defaults to Nightklass. */
  @IsOptional()
  @IsIn(PRODUCT_APPS)
  app?: ProductApp
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

export class ResendVerificationDto {
  @IsOptional()
  @IsIn(PRODUCT_APPS)
  app?: ProductApp
}
