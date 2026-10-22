import { ExamAccessGuard } from '../operations/exam-access'
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamMockService } from './exam-mock.service'
import { MockTemplateDto, SaveMockDto, StartMockDto } from './exam-mock.dto'
@Controller('exam-preparation')
@UseGuards(ExamAccessGuard)
export class ExamMockController {
  constructor(private readonly mocks: ExamMockService) {}
  @Get('goals/:id/mock-availability') availability(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.mocks.availability(id, u) }
  @Get('mocks') list(@CurrentUser() u: AuthUser) { return this.mocks.list(u) }
  @Post('mocks') start(@Body() dto: StartMockDto, @CurrentUser() u: AuthUser) { return this.mocks.start(dto, u) }
  @Get('mocks/:id') read(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.mocks.read(id, u) }
  @Patch('mocks/:id/answers') save(@Param('id') id: string, @Body() dto: SaveMockDto, @CurrentUser() u: AuthUser) { return this.mocks.save(id, dto, u) }
  @Post('mocks/:id/submit') submit(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.mocks.submit(id, u) }
}
@Controller('admin/nightklass/exam-content/mock-templates')
@UseGuards(NightklassAdminGuard)
export class ExamMockAdminController {
  constructor(private readonly mocks: ExamMockService) {}
  @Get() list() { return this.mocks.templates() }
  @Post() save(@Body() dto: MockTemplateDto, @CurrentUser() u: AuthUser) { return this.mocks.template(dto, u.id) }
}
