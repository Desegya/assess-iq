import { IsArray, ArrayMinSize, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AddQuestionsDto {
  @ApiProperty({ example: ['cldQ1', 'cldQ2'], description: 'Array of question IDs to add' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds!: string[]
}
