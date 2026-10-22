import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamSyllabusDto, ObjectiveStudyDto, SyllabusStateDto } from './exam-syllabus.dto'
import { ExamSyllabusService } from './exam-syllabus.service'
@Controller('admin/nightklass/exam-content/syllabuses')
@UseGuards(NightklassAdminGuard)
export class ExamSyllabusAdminController {
  constructor(private readonly syllabuses: ExamSyllabusService) {}
  @Get() list() {
    return this.syllabuses.list()
  }
  @Post() save(@Body() dto: ExamSyllabusDto, @CurrentUser() u: AuthUser) {
    return this.syllabuses.save(dto, u.id)
  }
  @Post(':id/state') state(
    @Param('id') id: string,
    @Body() dto: SyllabusStateDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.syllabuses.state(id, dto, u.id)
  }
}
@Controller('exam-preparation')
export class ExamSyllabusController {
  constructor(private readonly syllabuses: ExamSyllabusService) {}
  @Get('goals/:goalId/subjects/:key/coverage') coverage(
    @Param('goalId') id: string,
    @Param('key') key: string,
    @CurrentUser() u: AuthUser,
  ) {
    return this.syllabuses.coverage(id, key, u)
  }
  @Post('objectives/study') study(@Body() dto: ObjectiveStudyDto, @CurrentUser() u: AuthUser) {
    return this.syllabuses.study(dto, u)
  }
}
