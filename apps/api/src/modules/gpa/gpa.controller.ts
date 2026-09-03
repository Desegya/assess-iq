import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { GpaService } from './gpa.service'
import { CreateGpaEntryDto } from './dto/create-gpa-entry.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthUser } from '@assessiq/types'

@ApiTags('GPA')
@ApiBearerAuth()
@Controller('gpa')
export class GpaController {
  constructor(private readonly gpaService: GpaService) {}

  @Get()
  @ApiOperation({ summary: "List the current student's GPA entries" })
  findAll(@CurrentUser() user: AuthUser) {
    return this.gpaService.findAll(user)
  }

  @Post()
  @ApiOperation({ summary: 'Add a course grade to the GPA calculator' })
  create(@Body() dto: CreateGpaEntryDto, @CurrentUser() user: AuthUser) {
    return this.gpaService.create(dto, user)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a GPA entry' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.gpaService.remove(id, user)
  }
}
