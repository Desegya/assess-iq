import { serializable } from '../../common/serializable'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AuthUser, UserRole } from '@assessiq/types'
import { Prisma } from '@assessiq/db'
import { PrismaService } from '../prisma/prisma.service'
import { ExamMockService } from './exam-mock.service'
import { ExamAccessService } from '../operations/exam-access'
import { StartWaecPaperDto, WaecPaperDto, WaecSectionDto } from './waec-paper.dto'
import { validateSections, WaecQuestion } from './waec-paper.rules'
import { subjectIdentity } from './exam-content.rules'
import { freezeQuestion } from './exam-mock.rules'
import { recordExposures, sampleQuestionIds } from './exam-sampling'
import { formatDisclosure } from './exam-format'
@Injectable()
export class WaecPaperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mocks: ExamMockService,
    private readonly access: ExamAccessService,
  ) {}
  list() {
    return this.prisma.waecPaperTemplate.findMany({
      take: 100,
      orderBy: [{ year: 'desc' }, { subject: 'asc' }],
    })
  }
  async save(dto: WaecPaperDto, actorId: string) {
    validateSections(dto.sections)
    const { expectedRevision, id, ...data } = dto
    try {
      return await serializable(this.prisma, 
        async (tx) => {
          const grant = await tx.nightklassAdmin.findUnique({
            where: { userId: actorId },
            include: { user: { select: { status: true, organizationId: true } } },
          })
          if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId)
            throw new ForbiddenException('Administrator access required')
          const fields = {
            ...data,
            subjectKey: subjectIdentity(dto.subject),
            sections: dto.sections as unknown as Prisma.InputJsonValue,
          }
          let paper
          if (!id && expectedRevision === 0)
            paper = await tx.waecPaperTemplate.create({ data: fields })
          else {
            if (!id) throw new BadRequestException('Select the paper to edit')
            const updated = await tx.waecPaperTemplate.updateMany({
              where: { id, revision: expectedRevision },
              data: { ...fields, revision: { increment: 1 } },
            })
            if (!updated.count) throw new ConflictException('Paper changed. Reload before saving.')
            paper = await tx.waecPaperTemplate.findUniqueOrThrow({ where: { id } })
          }
          await tx.nightklassAdminAudit.create({
            data: {
              actorId,
              action: 'exam.waec-paper.save',
              resourceType: 'waec-paper',
              resourceId: paper.id,
            },
          })
          return paper
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (err) {
      if (['P2002', 'P2034'].includes((err as { code: string })?.code))
        throw new ConflictException('Duplicate paper or concurrent change. Reload and try again.')
      throw err
    }
  }
  private async goal(goalId: string, user: AuthUser) {
    if (user.organizationId || user.role !== UserRole.STUDENT)
      throw new ForbiddenException('Standalone learner access required')
    const goal = await this.prisma.examGoal.findFirst({
      where: { id: goalId, studentId: user.id, exam: 'WAEC' },
      include: { subjects: true },
    })
    if (!goal) throw new NotFoundException('WAEC goal not found')
    return goal
  }
  async availability(goalId: string, user: AuthUser) {
    const goal = await this.goal(goalId, user)
    const papers = await this.prisma.waecPaperTemplate.findMany({
      where: {
        year: goal.year,
        series: goal.series,
        subjectKey: { in: goal.subjects.map((s) => s.subjectKey) },
        status: 'APPROVED',
      },
      orderBy: [{ subject: 'asc' }, { series: 'asc' }, { paperCode: 'asc' }],
    })
    return Promise.all(
      papers.map(async (paper) => {
        const sections = paper.sections as unknown as WaecSectionDto[]
        const used = new Set<string>()
        const coverage = []
        for (const s of [...sections].sort((a, b) => Number(!!b.topic) - Number(!!a.topic))) {
          const bank = await this.prisma.examBankQuestion.findMany({
            where: {
              exam: 'WAEC',
              subjectKey: paper.subjectKey,
              questionType: s.questionType,
              marks: s.marks,
              status: 'APPROVED',
              ...(s.topic ? { topic: { equals: s.topic, mode: 'insensitive' as const } } : {}),
              id: { notIn: [...used] },
            },
            take: s.count,
            orderBy: { id: 'asc' },
            select: { id: true },
          })
          bank.forEach((q) => used.add(q.id))
          coverage.push({ title: s.title, available: bank.length, required: s.count })
        }
        const active = await this.prisma.examMockAttempt.findUnique({
          where: { activeKey: `${user.id}:${goalId}:${paper.id}` },
          select: { id: true },
        })
        return {
          ...paper,
          format: formatDisclosure('WAEC'),
          coverage,
          ready: coverage.every((s) => s.available === s.required),
          active,
        }
      }),
    )
  }
  async start(dto: StartWaecPaperDto, user: AuthUser) {
    const goal = await this.goal(dto.goalId, user)
    const repeated = await this.prisma.examMockAttempt.findUnique({
      where: { studentId_requestKey: { studentId: user.id, requestKey: dto.requestKey } },
    })
    if (repeated) {
      if (repeated.goalId !== goal.id || repeated.waecPaperId !== dto.paperId)
        throw new ConflictException('Start request belongs to another paper')
      return this.mocks.read(repeated.id, user)
    }
    const activeKey = `${user.id}:${goal.id}:${dto.paperId}`
    const active = await this.prisma.examMockAttempt.findUnique({ where: { activeKey } })
    if (active) return this.mocks.read(active.id, user)
    await this.access.assertCanStartAttempt()
    const paper = await this.prisma.waecPaperTemplate.findFirst({
      where: {
        id: dto.paperId,
        year: goal.year,
        series: goal.series,
        subjectKey: { in: goal.subjects.map((s) => s.subjectKey) },
        status: 'APPROVED',
      },
    })
    if (!paper) throw new NotFoundException('Published paper not found for your WAEC goal')
    const sections = paper.sections as unknown as WaecSectionDto[]
    const questions: WaecQuestion[] = []
    for (const s of [...sections].sort((a, b) => Number(!!b.topic) - Number(!!a.topic))) {
      // Sampled per section (marks, type and optional topic), unseen questions first,
      // so retakes draw distinct forms while keeping the paper's structure.
      const ids = await sampleQuestionIds(this.prisma, {
        studentId: user.id,
        exam: 'WAEC',
        subjectKey: paper.subjectKey,
        questionType: s.questionType,
        marks: s.marks,
        topic: s.topic || undefined,
        excludeIds: questions.map((q) => q.id),
        count: s.count,
      })
      if (ids.length < s.count)
        throw new BadRequestException(
          `${s.title} needs ${s.count} reviewed questions carrying ${s.marks} marks each; ${ids.length} available`,
        )
      const rows = await this.prisma.examBankQuestion.findMany({ where: { id: { in: ids } } })
      const byId = new Map(rows.map((q) => [q.id, q]))
      questions.push(
        ...ids.map((id) => {
          const q = byId.get(id)!
          return {
            ...freezeQuestion(q),
            sectionId: s.id,
            questionType: q.questionType as WaecQuestion['questionType'],
            marks: q.marks,
          }
        }),
      )
    }
    try {
      const attempt = await this.prisma.examMockAttempt.create({
        data: {
          studentId: user.id,
          goalId: goal.id,
          waecPaperId: paper.id,
          requestKey: dto.requestKey,
          activeKey,
          expiresAt: new Date(Date.now() + paper.durationMinutes * 60000),
          flags: [],
          selectedQuestions: [],
          questions: questions as unknown as Prisma.InputJsonValue,
          specification: {
            exam: 'WAEC',
            title: paper.title,
            year: paper.year,
            series: paper.series,
            paperCode: paper.paperCode,
            durationMinutes: paper.durationMinutes,
            instructions: paper.instructions,
            sourceNote: paper.sourceNote,
            templateRevision: paper.revision,
            format: formatDisclosure('WAEC'),
            sections: sections as unknown as Prisma.InputJsonValue,
          },
        },
      })
      await recordExposures(this.prisma, user.id, questions.map((q) => q.id))
      return this.mocks.read(attempt.id, user)
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const existing = await this.prisma.examMockAttempt.findUnique({ where: { activeKey } })
        if (existing) return this.mocks.read(existing.id, user)
      }
      throw err
    }
  }
}
