import { Equals, IsString, MaxLength, MinLength } from 'class-validator'

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string

  // Typed confirmation guards against accidental or scripted one-click deletion.
  @Equals('DELETE MY ACCOUNT')
  confirmation!: string
}
