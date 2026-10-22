import { IsEmail, IsIn, IsOptional, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** Must match PRIVACY_NOTICE_VERSION in apps/nightklass/src/lib/privacy.ts. */
export const PRIVACY_NOTICE_VERSION = '2026-10-23'

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

  // Optional while older frontends roll over; the Nightklass form always sends it.
  @IsOptional()
  @IsIn([PRIVACY_NOTICE_VERSION], { message: 'Please review the current privacy notice' })
  privacyNoticeVersion?: string
}
