import { ExamAccessGuard, ExamAccessService } from '../operations/exam-access'
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { SaveExamGoalDto } from './exam-goal.dto'
import { ExamPreparationService } from './exam-preparation.service'

@ApiTags('exam-preparation')
@ApiBearerAuth()
@Controller('exam-preparation')
@UseGuards(ExamAccessGuard)
export class ExamPreparationController {
  constructor(private readonly service: ExamPreparationService) {}

  @Get('goals')
  list(@CurrentUser() user: AuthUser) { return this.service.list(user) }

  @Put('goals')
  save(@Body() dto: SaveExamGoalDto, @CurrentUser() user: AuthUser) { return this.service.save(dto, user) }
}

// Deliberately outside ExamAccessGuard so the app can explain pilot availability.
@ApiTags('exam-preparation')
@ApiBearerAuth()
@Controller('exam-preparation/access')
export class ExamAccessStatusController {
  constructor(private readonly access: ExamAccessService) {}
  @Get()
  status(@CurrentUser() user: AuthUser) { return this.access.status(user) }
}
