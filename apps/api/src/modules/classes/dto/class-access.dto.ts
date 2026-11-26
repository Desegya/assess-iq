import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export const JOIN_POLICIES = ['EMAIL_DOMAIN', 'EMAIL_LIST', 'APPROVAL', 'OPEN_LINK'] as const
export type JoinPolicy = (typeof JOIN_POLICIES)[number]

export class UpdateClassAccessDto {
  @ApiPropertyOptional({ enum: JOIN_POLICIES })
  @IsOptional()
  @IsIn(JOIN_POLICIES)
  joinPolicy?: JoinPolicy

  @ApiPropertyOptional({ example: ['ug.edu.gh'], description: 'School email domains for EMAIL_DOMAIN' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(253, { each: true })
  allowedEmailDomains?: string[]

  @ApiPropertyOptional({ description: 'Whether new students can join with the link' })
  @IsOptional()
  @IsBoolean()
  joiningOpen?: boolean
}

export class ClassEmailsDto {
  @ApiProperty({ example: ['kofi@st.ug.edu.gh'] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsEmail({}, { each: true, message: 'Each entry must be a valid email address' })
  emails!: string[]
}

export class EnrollmentDecisionDto {
  @ApiProperty({ enum: ['ACTIVE', 'REMOVED'] })
  @IsIn(['ACTIVE', 'REMOVED'])
  status!: 'ACTIVE' | 'REMOVED'
}
