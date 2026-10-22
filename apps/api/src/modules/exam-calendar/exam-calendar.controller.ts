import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ThrottlerGuard } from '@nestjs/throttler'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamCalendarService } from './exam-calendar.service'
import { CalendarStateDto, ExamCalendarDto, UploadTimetableDto } from './exam-calendar.dto'
@Controller('admin/nightklass/exam-content/calendars')
@UseGuards(NightklassAdminGuard, ThrottlerGuard)
export class ExamCalendarAdminController {
  constructor(private readonly calendars: ExamCalendarService) {}
  @Get() list() {
    return this.calendars.list()
  }
  @Post() save(@Body() dto: ExamCalendarDto, @CurrentUser() u: AuthUser) {
    return this.calendars.save(dto, u.id)
  }
  @Post(':id/state') state(
    @Param('id') id: string,
    @Body() dto: CalendarStateDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.calendars.state(id, dto, u.id)
  }
  @Get(':id/file') file(@Param('id') id: string) {
    return this.calendars.adminFile(id)
  }
  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 } }),
  )
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadTimetableDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.calendars.upload(id, dto.expectedRevision, file, u.id)
  }
}
@Controller('exam-preparation')
@UseGuards(ThrottlerGuard)
export class ExamCalendarController {
  constructor(private readonly calendars: ExamCalendarService) {}
  @Get('goals/:id/calendar') calendar(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.calendars.forGoal(id, u)
  }
}
