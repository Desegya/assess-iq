import { IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy'

export class ReviewFlashcardDto {
  @ApiProperty({ enum: ['again', 'hard', 'good', 'easy'] })
  @IsIn(['again', 'hard', 'good', 'easy'])
  rating!: FlashcardRating
}
