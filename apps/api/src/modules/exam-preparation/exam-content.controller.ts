import { ExamAccessGuard } from '../operations/exam-access'
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamContentService } from './exam-content.service'
import {
  BankPracticeDto,
  BankQuestionDto,
  BankStateDto,
  BulkBankStateDto,
  ContentFilterDto,
  CreateExamMaterialDto,
  EditBankQuestionDto,
  GenerateBankDto,
  MaterialStateDto,
  UploadExamMaterialDto,
} from './exam-content.dto'
import { ObjectiveMappingDto, SyllabusStateDto } from './exam-syllabus.dto'
import { extractExamMaterial } from './exam-material.extract'

@Controller('admin/nightklass/exam-content')
@UseGuards(NightklassAdminGuard)
export class ExamContentAdminController {
  constructor(private readonly content: ExamContentService) {}
  @Get('materials') materials(@Query() q: ContentFilterDto) {
    return this.content.materials(q)
  }
  @Get('materials/:id') material(@Param('id') id: string) {
    return this.content.material(id)
  }
  @Post('materials') createMaterial(
    @Body() dto: CreateExamMaterialDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.createMaterial(dto, u.id)
  }
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 6 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadExamMaterialDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.createMaterial({ ...dto, body: await extractExamMaterial(file) }, u.id)
  }
  @Patch('materials/:id') materialState(
    @Param('id') id: string,
    @Body() dto: MaterialStateDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.materialState(id, dto.status, u.id)
  }
  @Post('questions/:id/correction') correction(
    @Param('id') id: string,
    @Body() dto: SyllabusStateDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.correction(id, dto.expectedRevision, u.id)
  }
  @Post('questions/:id/objectives') objectives(
    @Param('id') id: string,
    @Body() dto: ObjectiveMappingDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.mapObjectives(id, dto.objectiveIds, dto.expectedRevision, u.id)
  }
  @Get('questions/:id/similar') similar(@Param('id') id: string) {
    return this.content.similar(id)
  }
  @Get('questions') questions(@Query() q: ContentFilterDto) {
    return this.content.questions(q)
  }
  @Post('questions') question(@Body() dto: BankQuestionDto, @CurrentUser() u: AuthUser) {
    return this.content.createQuestion(dto, u.id)
  }
  @Post('generate') generate(@Body() dto: GenerateBankDto, @CurrentUser() u: AuthUser) {
    return this.content.generate(dto, u.id)
  }
  @Patch('questions/:id') edit(
    @Param('id') id: string,
    @Body() dto: EditBankQuestionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.editQuestion(id, dto, u.id)
  }
  @Post('questions/bulk-state') bulkState(@Body() dto: BulkBankStateDto, @CurrentUser() u: AuthUser) {
    return this.content.bulkQuestionState(dto.ids, dto.status, u.id)
  }
  @Post('questions/:id/state') state(
    @Param('id') id: string,
    @Body() dto: BankStateDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.questionState(id, dto, u.id)
  }
}
@Controller('exam-preparation')
@UseGuards(ExamAccessGuard)
export class ExamContentLearnerController {
  constructor(private readonly content: ExamContentService) {}
  @Get('goals/:goalId/subjects/:subjectKey/materials') materials(
    @Param('goalId') id: string,
    @Param('subjectKey') key: string,
    @CurrentUser() u: AuthUser,
  ) {
    return this.content.learnerMaterials(id, key, u)
  }
  @Post('practice') practice(@Body() dto: BankPracticeDto, @CurrentUser() u: AuthUser) {
    return this.content.practice(dto, u)
  }
}
