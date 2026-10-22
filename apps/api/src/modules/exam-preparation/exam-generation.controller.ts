import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { IsUUID } from 'class-validator'
import { ThrottlerGuard } from '@nestjs/throttler'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { GenerateBankDto } from './exam-content.dto'
import { ExamGenerationService } from './exam-generation.service'
class EnqueueGenerationDto extends GenerateBankDto {
  @IsUUID() requestKey!: string
}
@Controller('admin/nightklass/exam-content/generation-jobs')
@UseGuards(NightklassAdminGuard, ThrottlerGuard)
export class ExamGenerationController {
  constructor(private readonly generation: ExamGenerationService) {}
  @Get() list(@CurrentUser() u: AuthUser) {
    return this.generation.list(u.id)
  }
  @Post() enqueue(@Body() dto: EnqueueGenerationDto, @CurrentUser() u: AuthUser) {
    const { requestKey, ...payload } = dto
    return this.generation.enqueue(payload, requestKey, u.id)
  }
}
