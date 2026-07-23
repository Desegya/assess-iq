import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AvailabilitySlotDto {
  @ApiProperty({ example: 1, description: '0 = Sunday .. 6 = Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number

  @ApiProperty({ example: '18:00' })
  @IsString()
  startTime!: string

  @ApiProperty({ example: '20:00' })
  @IsString()
  endTime!: string

  @ApiPropertyOptional({ example: 90, description: 'Cap on minutes to schedule this day, if less than the full window' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxMinutes?: number
}

export class SetAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots!: AvailabilitySlotDto[]
}
