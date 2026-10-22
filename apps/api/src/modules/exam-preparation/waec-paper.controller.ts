import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { StartWaecPaperDto, WaecPaperDto } from './waec-paper.dto'
import { WaecPaperService } from './waec-paper.service'
@Controller('admin/nightklass/exam-content/waec-papers')
@UseGuards(NightklassAdminGuard, ThrottlerGuard)
export class WaecPaperAdminController {
  constructor(private readonly papers: WaecPaperService) {}
  @Get() list() {
    return this.papers.list()
  }
  @Post() save(@Body() dto: WaecPaperDto, @CurrentUser() u: AuthUser) {
    return this.papers.save(dto, u.id)
  }
}
@Controller('exam-preparation')
@UseGuards(ThrottlerGuard)
export class WaecPaperController {
  constructor(private readonly papers: WaecPaperService) {}
  @Get('goals/:id/waec-papers') list(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.papers.availability(id, u)
  }
  @Post('waec-papers/start') start(@Body() dto: StartWaecPaperDto, @CurrentUser() u: AuthUser) {
    return this.papers.start(dto, u)
  }
}
