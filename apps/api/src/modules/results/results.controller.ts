import { BadRequestException, Controller, Get, Param, Query, StreamableFile } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { AuthUser, UserRole } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { EXPORT_FORMATS, ExportFile, ExportFormat, ResultsExportService } from './results-export.service'

function file({ buffer, contentType, filename }: ExportFile) {
  return new StreamableFile(buffer, { type: contentType, disposition: `attachment; filename="${filename}"` })
}
function formatOf(raw: string | undefined): ExportFormat {
  const format = (raw ?? 'csv').toLowerCase()
  if (!EXPORT_FORMATS.includes(format as ExportFormat)) throw new BadRequestException(`format must be one of: ${EXPORT_FORMATS.join(', ')}`)
  return format as ExportFormat
}

/** Lecturers download results as CSV, Excel or PDF. */
@ApiTags('Results')
@ApiBearerAuth()
@Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
@Controller()
export class ResultsController {
  constructor(private readonly exports: ResultsExportService) {}

  @Get('assessments/:id/results/export')
  @ApiOperation({ summary: 'Download one test’s results (every student in the class, latest attempt)' })
  @ApiQuery({ name: 'format', enum: EXPORT_FORMATS, required: false })
  async assessment(@Param('id') id: string, @Query('format') format: string | undefined, @CurrentUser() user: AuthUser) {
    return file(await this.exports.assessmentResults(id, user, formatOf(format)))
  }

  @Get('classes/:id/results/export')
  @ApiOperation({ summary: 'Download a class gradebook: students × tests, with average and grade' })
  @ApiQuery({ name: 'format', enum: EXPORT_FORMATS, required: false })
  async gradebook(@Param('id') id: string, @Query('format') format: string | undefined, @CurrentUser() user: AuthUser) {
    return file(await this.exports.classGradebook(id, user, formatOf(format)))
  }
}
