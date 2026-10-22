import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { AuthUser } from '@assessiq/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NightklassAdminGuard } from '../admin/admin.guard'
import { AiQuotaService } from '../ai/ai-quota.service'
import { PrismaService } from '../prisma/prisma.service'
import { RuntimeSettingsService } from './runtime-settings.service'
import { CohortMemberDto, RuntimeSettingDto } from './operations.dto'

function requireOwner(req: { adminRole?: string }) {
  if (req.adminRole !== 'OWNER') throw new ForbiddenException('Owner access required')
}

@Controller('admin/nightklass/operations')
@UseGuards(NightklassAdminGuard)
export class OperationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: RuntimeSettingsService,
    private readonly quota: AiQuotaService,
  ) {}

  @Get('settings') listSettings() {
    return this.settings.list()
  }

  /** Kill switches and budgets take effect within seconds and are audited. */
  @Put('settings') setSetting(@Body() dto: RuntimeSettingDto, @CurrentUser() u: AuthUser, @Req() req: { adminRole?: string }) {
    requireOwner(req)
    return this.settings.set(dto.key, dto.value ?? null, u.id)
  }

  @Get('ai-usage') aiUsage() {
    return this.quota.usageSummary()
  }

  /** Operational signals for the pilot: anything non-zero in `attention` needs a look. */
  @Get('summary') async summary() {
    const now = new Date()
    const minuteAgo = new Date(now.getTime() - 60_000)
    const dayAgo = new Date(now.getTime() - 86_400_000)
    const [overdueExpiry, gradingQueued, gradingOverdue, gradingFailed, generationFailed, generationQueued, openReports] = await Promise.all([
      this.prisma.examMockAttempt.count({ where: { status: 'IN_PROGRESS', expiresAt: { lt: minuteAgo } } }),
      this.prisma.examMockAttempt.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.examMockAttempt.count({ where: { status: 'SUBMITTED', submittedAt: { lt: new Date(now.getTime() - 10 * 60_000) } } }),
      this.prisma.examMockAttempt.count({ where: { submittedAt: { gt: dayAgo }, result: { path: ['gradingFailed'], equals: true } } }),
      this.prisma.examGenerationJob.count({ where: { status: 'FAILED', updatedAt: { gt: dayAgo } } }),
      this.prisma.examGenerationJob.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
      this.prisma.examQuestionReport.count({ where: { status: 'OPEN' } }),
    ])
    return {
      generatedAt: now,
      attention: {
        attemptsPastExpiryNotFinalized: overdueExpiry,
        writtenMarkingOlderThan10Minutes: gradingOverdue,
        writtenMarkingFailedLast24h: gradingFailed,
        generationJobsFailedLast24h: generationFailed,
        openQuestionReports: openReports,
      },
      queues: { writtenMarking: gradingQueued, generation: generationQueued },
      ai: await this.quota.usageSummary(),
      settings: await this.settings.list(),
    }
  }

  @Get('exam-cohort') async cohort() {
    const members = await this.prisma.examCohortMember.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    return members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, addedAt: m.createdAt }))
  }

  @Post('exam-cohort') async addToCohort(@Body() dto: CohortMemberDto, @CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email.trim(), mode: 'insensitive' }, organizationId: null, role: 'STUDENT', deletedAt: null },
    })
    if (!user) throw new NotFoundException('No standalone learner account uses that email')
    await this.prisma.$transaction([
      this.prisma.examCohortMember.upsert({
        where: { userId: user.id },
        create: { userId: user.id, addedById: u.id },
        update: {},
      }),
      this.prisma.nightklassAdminAudit.create({
        data: { actorId: u.id, action: 'exam-cohort.add', resourceType: 'user', resourceId: user.id },
      }),
    ])
    return { userId: user.id, email: user.email }
  }

  @Delete('exam-cohort/:userId') async removeFromCohort(@Param('userId') userId: string, @CurrentUser() u: AuthUser) {
    await this.prisma.$transaction([
      this.prisma.examCohortMember.deleteMany({ where: { userId } }),
      this.prisma.nightklassAdminAudit.create({
        data: { actorId: u.id, action: 'exam-cohort.remove', resourceType: 'user', resourceId: userId },
      }),
    ])
    return { removed: true }
  }
}
