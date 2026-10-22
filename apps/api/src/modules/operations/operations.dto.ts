import { IsEmail, IsIn, IsOptional } from 'class-validator'
import { SETTINGS } from './runtime-settings'

export class RuntimeSettingDto {
  @IsIn(Object.keys(SETTINGS)) key!: keyof typeof SETTINGS
  // Validated per key by parseSetting; null clears the override.
  @IsOptional() value!: unknown
}

export class CohortMemberDto {
  @IsEmail() email!: string
}
