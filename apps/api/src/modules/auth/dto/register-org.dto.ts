import { IsEmail, IsEnum, IsOptional, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OrgType } from '@assessiq/types'

export class RegisterOrgDto {
  @ApiProperty({ example: 'Greenfield Academy' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  orgName!: string

  @ApiProperty({ enum: OrgType, example: OrgType.SECONDARY_SCHOOL })
  @IsEnum(OrgType)
  orgType!: OrgType

  @ApiProperty({ example: 'Dr. Chukwuemeka Obi' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  adminName!: string

  @ApiProperty({ example: 'admin@greenfieldacademy.edu.ng' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  adminEmail!: string

  @ApiProperty({ example: 'strongpassword123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string

  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsString()
  @IsOptional()
  country?: string
}
