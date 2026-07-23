import { ArrayMinSize, IsArray, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ReorderTopicsDto {
  @ApiProperty({ type: [String], description: 'Topic ids in the desired order' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  topicIds!: string[]
}
