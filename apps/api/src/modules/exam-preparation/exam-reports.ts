import { Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { AuthUser, UserRole } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { ExamAccessGuard } from '../operations/exam-access'
import { PrismaService } from '../prisma/prisma.service'

export const REPORT_REASONS = ['WRONG_ANSWER', 'AMBIGUOUS', 'TYPO', 'OUT_OF_SYLLABUS', 'MISSING_CONTEXT', 'OTHER'] as const

export class ReportQuestionDto {
  /** A bank question id (as shown in mocks) or a practice-copy id. */
  @IsString() @MinLength(1) @MaxLength(100) questionId!: string
  @IsOptional() @IsString() @MaxLength(100) attemptId?: string
  @IsIn(REPORT_REASONS) reason!: (typeof REPORT_REASONS)[number]
  @IsString() @MinLength(5) @MaxLength(2000) details!: string
}

export class ResolveReportDto {
  @IsIn(['RESOLVED', 'DISMISSED']) status!: 'RESOLVED' | 'DISMISSED'
  @IsString() @MinLength(3) @MaxLength(2000) resolutionNote!: string
}

export class ReportFilterDto {
  @IsOptional() @IsIn(['OPEN', 'RESOLVED', 'DISMISSED']) status?: string
}

@Injectable()
export class ExamReportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Learners may report only reviewed questions they were actually shown. */
  async report(dto: ReportQuestionDto, user: AuthUser) {
    if (user.organizationId || user.role !== UserRole.STUDENT) throw new ForbiddenException('Standalone learner access required')
    const copy = await this.prisma.question.findFirst({
      where: { id: dto.questionId, createdById: user.id, sourceExamBankQuestionId: { not: null } },
      select: { sourceExamBankQuestionId: true },
    })
    const questionId = copy?.sourceExamBankQuestionId ?? dto.questionId
    const seen = await this.prisma.examQuestionExposure.findUnique({
      where: { studentId_questionId: { studentId: user.id, questionId } },
    })
    if (!seen) throw new NotFoundException('Question not found in your practice or mocks')
    return this.prisma.examQuestionReport.upsert({
      where: { reporterId_questionId: { reporterId: user.id, questionId } },
      create: { questionId, reporterId: user.id, attemptId: dto.attemptId, reason: dto.reason, details: dto.details },
      update: { reason: dto.reason, details: dto.details, attemptId: dto.attemptId, status: 'OPEN', resolvedAt: null, resolvedById: null },
      select: { id: true, status: true, reason: true, createdAt: true },
    })
  }

  list(status = 'OPEN') {
    return this.prisma.examQuestionReport.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { question: { select: { id: true, exam: true, subject: true, topic: true, questionText: true, status: true, revision: true } } },
    })
  }

  async resolve(id: string, dto: ResolveReportDto, actorId: string) {
    const [report] = await this.prisma.$transaction([
      this.prisma.examQuestionReport.update({
        where: { id },
        data: { status: dto.status, resolutionNote: dto.resolutionNote, resolvedById: actorId, resolvedAt: new Date() },
      }),
      this.prisma.nightklassAdminAudit.create({
        data: { actorId, action: 'exam.question-report.' + dto.status.toLowerCase(), resourceType: 'exam-question-report', resourceId: id },
      }),
    ])
    return report
  }
}

@Controller('exam-preparation/question-reports')
@UseGuards(ExamAccessGuard)
export class ExamReportController {
  constructor(private readonly reports: ExamReportService) {}
  @Post() report(@Body() dto: ReportQuestionDto, @CurrentUser() u: AuthUser) {
    return this.reports.report(dto, u)
  }
}

@Controller('admin/nightklass/exam-content/question-reports')
@UseGuards(NightklassAdminGuard)
export class ExamReportAdminController {
  constructor(private readonly reports: ExamReportService) {}
  @Get() list(@Query() q: ReportFilterDto) {
    return this.reports.list(q.status)
  }
  @Patch(':id') resolve(@Param('id') id: string, @Body() dto: ResolveReportDto, @CurrentUser() u: AuthUser) {
    return this.reports.resolve(id, dto, u.id)
  }
}
