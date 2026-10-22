import { serializable } from '../../common/serializable'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { Prisma } from '@assessiq/db'
import { AuthUser, UserRole } from '@assessiq/types'
import { AiService } from '../ai/ai.service'
import { AiPausedException } from '../ai/ai-quota.service'
import { ExamAccessService } from '../operations/exam-access'

import { WaecSectionDto } from './waec-paper.dto'
import { chosenWaecQuestions, markWaec, WaecGrade, WaecQuestion } from './waec-paper.rules'
import { PrismaService } from '../prisma/prisma.service'
import { MockTemplateDto, SaveMockDto, StartMockDto } from './exam-mock.dto'
import { freezeQuestion, FrozenMockQuestion, markMock } from './exam-mock.rules'
import { recordExposures, sampleQuestionIds } from './exam-sampling'
import { formatDisclosure } from './exam-format'
import { waitUntil } from '../../common/wait-until'

/** Bump when the marking pipeline (batching, validation, aggregation) changes. */
const MARKING_CONCURRENCY = 4

export const WRITTEN_MARKING_IMPLEMENTATION = 'waec-written/2026-10-23.1'

// Recorded with every written result so marks remain traceable to the model and
// prompt that produced them. Results are indicative until calibration evidence
// for the subject exists; nothing here claims calibrated accuracy.
function gradingRecord(meta: { model?: string; promptVersion?: string }) {
  return {
    model: meta.model ?? 'unknown',
    promptVersion: meta.promptVersion ?? 'unknown',
    implementation: WRITTEN_MARKING_IMPLEMENTATION,
    reliability: 'INDICATIVE',
  }
}

@Injectable()
export class ExamMockService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly access: ExamAccessService,
  ) {}
  private readonly logger = new Logger(ExamMockService.name)
  private timer?: ReturnType<typeof setInterval>
  private sweeping = false
  private stopping = false
  // Grading leases this process holds, released on shutdown so another instance resumes promptly.
  private readonly leases = new Map<string, Date>()
  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), 30000)
    this.timer.unref()
    void this.sweep()
  }
  async onModuleDestroy() {
    this.stopping = true
    if (this.timer) clearInterval(this.timer)
    await waitUntil(() => !this.sweeping && !this.leases.size, 10_000)
    for (const [id, lease] of this.leases)
      await this.prisma.examMockAttempt
        .updateMany({
          where: { id, status: 'SUBMITTED', gradingLeaseUntil: lease },
          // Partial grades are already saved; refund the interrupted attempt and make it due now.
          data: {
            gradingLeaseUntil: null,
            gradingNextAt: new Date(),
            gradingAttempts: { decrement: 1 },
          },
        })
        .catch(() => undefined)
  }
  private learner(user: AuthUser) {
    if (user.organizationId || user.role !== UserRole.STUDENT)
      throw new ForbiddenException('Standalone learner access required')
  }
  templates() {
    return this.prisma.examMockTemplate.findMany({ orderBy: { year: 'desc' }, take: 50 })
  }
  async template(dto: MockTemplateDto, actorId: string) {
    const { expectedRevision, ...data } = dto
    return serializable(
      this.prisma,
      async (tx) => {
        const grant = await tx.nightklassAdmin.findUnique({
          where: { userId: actorId },
          include: { user: { select: { status: true, organizationId: true } } },
        })
        if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId)
          throw new ForbiddenException('Administrator access required')
        let result
        if (expectedRevision === 0) result = await tx.examMockTemplate.create({ data })
        else {
          const changed = await tx.examMockTemplate.updateMany({
            where: { year: dto.year, revision: expectedRevision },
            data: { ...data, revision: { increment: 1 } },
          })
          if (changed.count !== 1)
            throw new ConflictException('Template changed. Reload before saving.')
          result = await tx.examMockTemplate.findUniqueOrThrow({ where: { year: dto.year } })
        }
        await tx.nightklassAdminAudit.create({
          data: {
            actorId,
            action: 'exam.mock-template.save',
            resourceType: 'exam-template',
            resourceId: result.id,
          },
        })
        return result
      },
      { isolationLevel: 'Serializable' },
    ).catch((err) => {
      if (['P2002', 'P2034'].includes(err?.code))
        throw new ConflictException('Concurrent template change. Reload and try again.')
      throw err
    })
  }
  private async goal(id: string, user: AuthUser) {
    this.learner(user)
    const goal = await this.prisma.examGoal.findFirst({
      where: { id, studentId: user.id },
      include: { subjects: true },
    })
    if (!goal) throw new NotFoundException('Exam goal not found')
    if (goal.exam !== 'JAMB')
      throw new BadRequestException(
        'Full WAEC paper mocks are not available yet. Use reviewed practice for now.',
      )
    if (goal.subjects.length !== 4 || !goal.subjects.some((s) => s.subjectKey === 'english'))
      throw new BadRequestException('Set up English and three other JAMB subjects first')
    return goal
  }
  async availability(goalId: string, user: AuthUser) {
    const goal = await this.goal(goalId, user)
    const template = await this.prisma.examMockTemplate.findFirst({
      where: { year: goal.year, status: 'APPROVED' },
    })
    const subjects = await Promise.all(
      goal.subjects.map(async (s) => ({
        subjectKey: s.subjectKey,
        name: s.name,
        required: template
          ? s.subjectKey === 'english'
            ? template.englishCount
            : template.otherCount
          : null,
        available: await this.prisma.examBankQuestion.count({
          where: {
            exam: 'JAMB',
            subjectKey: s.subjectKey,
            status: 'APPROVED',
            questionType: 'MCQ',
          },
        }),
      })),
    )
    const active = await this.prisma.examMockAttempt.findFirst({
      where: { studentId: user.id, goalId, status: 'IN_PROGRESS' },
      select: { id: true, expiresAt: true },
    })
    return {
      template,
      subjects,
      format: formatDisclosure('JAMB'),
      active,
      ready: !!template && subjects.every((s) => s.available >= s.required!),
    }
  }
  async list(user: AuthUser) {
    this.learner(user)
    return this.prisma.examMockAttempt.findMany({
      where: { studentId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        goalId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        submittedAt: true,
        result: true,
      },
    })
  }
  async start(dto: StartMockDto, user: AuthUser) {
    const goal = await this.goal(dto.goalId, user)
    const repeated = await this.prisma.examMockAttempt.findUnique({
      where: { studentId_requestKey: { studentId: user.id, requestKey: dto.requestKey } },
    })
    if (repeated) {
      if (repeated.goalId !== goal.id)
        throw new ConflictException('Start request belongs to another goal')
      return this.read(repeated.id, user)
    }
    const activeKey = `${user.id}:${goal.id}`
    const active = await this.prisma.examMockAttempt.findUnique({ where: { activeKey } })
    if (active) {
      await this.finish(active.id, true)
      const current = await this.prisma.examMockAttempt.findUniqueOrThrow({
        where: { id: active.id },
      })
      if (current.status === 'IN_PROGRESS') return this.view(current)
    }
    await this.access.assertCanStartAttempt()
    const template = await this.prisma.examMockTemplate.findFirst({
      where: { year: goal.year, status: 'APPROVED' },
    })
    if (!template)
      throw new BadRequestException(
        'A reviewed mock template has not been published for this exam year',
      )
    const frozen: FrozenMockQuestion[] = []
    for (const subject of [...goal.subjects].sort((a, b) =>
      a.subjectKey === 'english'
        ? -1
        : b.subjectKey === 'english'
          ? 1
          : a.name.localeCompare(b.name),
    )) {
      const count = subject.subjectKey === 'english' ? template.englishCount : template.otherCount
      const ids = await sampleQuestionIds(this.prisma, {
        studentId: user.id,
        exam: 'JAMB',
        subjectKey: subject.subjectKey,
        questionType: 'MCQ',
        count,
      })
      if (ids.length < count)
        throw new BadRequestException(
          `${subject.name} needs ${count} reviewed questions; ${ids.length} are available`,
        )
      const rows = await this.prisma.examBankQuestion.findMany({ where: { id: { in: ids } } })
      const byId = new Map(rows.map((q) => [q.id, q]))
      frozen.push(...ids.map((id) => freezeQuestion(byId.get(id)!)))
    }
    try {
      const attempt = await this.prisma.examMockAttempt.create({
        data: {
          studentId: user.id,
          goalId: goal.id,
          templateId: template.id,
          requestKey: dto.requestKey,
          activeKey,
          expiresAt: new Date(Date.now() + template.durationMinutes * 60000),
          questions: frozen as unknown as Prisma.InputJsonValue,
          flags: [],
          selectedQuestions: [],
          specification: {
            title: template.title,
            templateRevision: template.revision,
            instructions: template.instructions,
            durationMinutes: template.durationMinutes,
            sourceNote: template.sourceNote,
            year: goal.year,
            format: formatDisclosure('JAMB'),
          },
        },
      })
      await recordExposures(this.prisma, user.id, frozen.map((q) => q.id))
      return this.view(attempt)
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const current = await this.prisma.examMockAttempt.findUnique({ where: { activeKey } })
        if (current) return this.read(current.id, user)
      }
      throw err
    }
  }
  private view(attempt: {
    id: string
    status: string
    questions: unknown
    answers: unknown
    result: unknown
    version: number
    flags: string[]
    expiresAt: Date
    specification: unknown
    submittedAt: Date | null
    submissionReason: string | null
    selectedQuestions: string[]
  }) {
    const questions = attempt.questions as FrozenMockQuestion[]
    return {
      id: attempt.id,
      status: attempt.status,
      version: attempt.version,
      answers: attempt.answers,
      flags: attempt.flags,
      selectedQuestions: attempt.selectedQuestions,
      expiresAt: attempt.expiresAt,
      serverTime: new Date(),
      specification: attempt.specification,
      submittedAt: attempt.submittedAt,
      submissionReason: attempt.submissionReason,
      questions:
        attempt.status === 'IN_PROGRESS'
          ? questions.map(({ correctAnswer, explanation, optionOrder, ...q }) => q)
          : questions,
      result: attempt.result,
    }
  }
  async read(id: string, user: AuthUser) {
    this.learner(user)
    let attempt = await this.prisma.examMockAttempt.findFirst({ where: { id, studentId: user.id } })
    if (!attempt) throw new NotFoundException('Mock attempt not found')
    if (attempt.status === 'IN_PROGRESS' && attempt.expiresAt <= new Date()) {
      await this.finish(id, true)
      attempt = await this.prisma.examMockAttempt.findUniqueOrThrow({ where: { id } })
    }
    return this.view(attempt)
  }
  async save(id: string, dto: SaveMockDto, user: AuthUser) {
    this.learner(user)
    // No Serializable transaction: the version-checked conditional update below is the
    // concurrency control, so learners saving at the same time never fail each other.
    const tx = this.prisma
    const attempt = await tx.examMockAttempt.findFirst({ where: { id, studentId: user.id } })
    if (!attempt) throw new NotFoundException('Mock attempt not found')
    if (attempt.status !== 'IN_PROGRESS' || attempt.expiresAt <= new Date())
      throw new ConflictException('This mock has ended; reload to view your result')
    if (attempt.version !== dto.expectedVersion)
      throw new ConflictException('Answers changed in another request. Reload before continuing.')
    const questions = attempt.questions as unknown as FrozenMockQuestion[]
    const byId = new Map(questions.map((q) => [q.id, q]))
    if (new Set(dto.answers.map((a) => a.questionId)).size !== dto.answers.length)
      throw new BadRequestException('Duplicate answer IDs')
    const waec = !!attempt.waecPaperId
    const selected = dto.selectedQuestions ?? attempt.selectedQuestions
    if (waec)
      chosenWaecQuestions(
        questions as WaecQuestion[],
        (attempt.specification as unknown as { sections: WaecSectionDto[] }).sections,
        selected,
      )
    else if (selected.length) throw new BadRequestException('JAMB questions are all compulsory')
    if (
      dto.answers.some(
        (a) =>
          !byId.has(a.questionId) ||
          ((!waec || (byId.get(a.questionId) as WaecQuestion).questionType === 'MCQ') &&
            a.answer &&
            !byId.get(a.questionId)!.options.some((o) => o.key === a.answer)),
      ) ||
      dto.flags.some((flag) => !byId.has(flag))
    )
      throw new BadRequestException('Answer or flag does not belong to this paper')
    const answers = { ...(attempt.answers as Record<string, string>) }
    for (const a of dto.answers) answers[a.questionId] = a.answer
    const changed = await tx.examMockAttempt.updateMany({
      where: {
        id,
        version: dto.expectedVersion,
        status: 'IN_PROGRESS',
        expiresAt: { gt: new Date() },
      },
      data: {
        answers,
        selectedQuestions: selected,
        flags: [...new Set(dto.flags)],
        version: { increment: 1 },
      },
    })
    if (changed.count !== 1)
      throw new ConflictException('Mock changed or expired. Reload to continue.')
    return { version: attempt.version + 1, savedAt: new Date() }
  }
  async submit(id: string, user: AuthUser) {
    this.learner(user)
    const owned = await this.prisma.examMockAttempt.findFirst({
      where: { id, studentId: user.id },
      select: { id: true },
    })
    if (!owned) throw new NotFoundException('Mock attempt not found')
    await this.finish(id, false)
    void this.gradeWaec(id)
    return this.read(id, user)
  }
  private async finish(id: string, expiredOnly: boolean) {
    for (let retry = 0; retry < 3; retry++) {
      try {
        return await serializable(
          this.prisma,
          async (tx) => {
            const attempt = await tx.examMockAttempt.findUnique({ where: { id } })
            if (!attempt || attempt.status !== 'IN_PROGRESS') return
            const expired = attempt.expiresAt <= new Date()
            if (expiredOnly && !expired) return
            const waec = !!attempt.waecPaperId
            const questions = attempt.questions as unknown as WaecQuestion[]
            const answers = attempt.answers as Record<string, string>
            const sections = (attempt.specification as unknown as { sections: WaecSectionDto[] })
              .sections
            const chosen = waec
              ? chosenWaecQuestions(questions, sections, attempt.selectedQuestions, !expired)
              : []
            const pending =
              waec && chosen.some((q) => q.questionType !== 'MCQ' && answers[q.id]?.trim())
            const result = waec
              ? markWaec(questions, sections, attempt.selectedQuestions, answers, [], pending)
              : markMock(questions, answers)
            const changed = await tx.examMockAttempt.updateMany({
              where: { id, status: 'IN_PROGRESS', version: attempt.version },
              data: {
                status: pending ? 'SUBMITTED' : 'GRADED',
                gradingNextAt: pending ? new Date() : null,
                activeKey: null,
                submittedAt: new Date(),
                submissionReason: expired ? 'TIME_EXPIRED' : 'LEARNER_SUBMITTED',
                result: result as unknown as Prisma.InputJsonValue,
                version: { increment: 1 },
              },
            })
            if (changed.count !== 1) throw new ConflictException('Concurrent finalization')
          },
          { isolationLevel: 'Serializable' },
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'P2034' || err instanceof ConflictException) {
          if (retry < 2) continue
        }
        throw err
      }
    }
  }
  private async gradeWaec(id: string) {
    if (this.stopping) return
    const lease = new Date(Date.now() + 300000)
    try {
      const claim = await this.prisma.examMockAttempt.updateMany({
        where: {
          id,
          status: 'SUBMITTED',
          waecPaperId: { not: null },
          gradingNextAt: { lte: new Date() },
          OR: [{ gradingLeaseUntil: null }, { gradingLeaseUntil: { lt: new Date() } }],
        },
        data: { gradingLeaseUntil: lease, gradingAttempts: { increment: 1 } },
      })
      if (!claim.count) return
      this.leases.set(id, lease)
      const attempt = await this.prisma.examMockAttempt.findUniqueOrThrow({ where: { id } })
      const questions = attempt.questions as unknown as WaecQuestion[]
      const sections = (attempt.specification as unknown as { sections: WaecSectionDto[] }).sections
      const answers = attempt.answers as Record<string, string>
      const previous = attempt.result as unknown as {
        writtenGrades?: WaecGrade[]
        grading?: { model?: string; promptVersion?: string }
      }
      const grades: WaecGrade[] = previous.writtenGrades ?? []
      let gradingMeta: { model?: string; promptVersion?: string } = previous.grading ?? {}
      try {
        if (attempt.gradingAttempts > 3) throw new Error('Recovered exhausted grading lease')
        const written = chosenWaecQuestions(questions, sections, attempt.selectedQuestions).filter(
          (q) =>
            q.questionType !== 'MCQ' && answers[q.id]?.trim() && !grades.some((g) => g.id === q.id),
        )
        for (let start = 0; start < written.length; start += 5) {
          const batch = written.slice(start, start + 5)
          const {
            grades: marked,
            model,
            promptVersion,
          } = await this.ai.gradeWrittenAnswers(
            batch.map((q) => ({
              id: q.id,
              type: q.questionType as 'SHORT_ANSWER' | 'THEORY',
              question: q.questionText,
              // Bank convention: correctAnswer holds the marking scheme/guide that marks are
              // awarded against; explanation holds teacher notes or an example answer.
              markingScheme: q.correctAnswer,
              teacherNotes: q.explanation,
              marks: q.marks,
              studentAnswer: answers[q.id]!,
            })),
            'Nigerian senior secondary WAEC-style practice. Apply the teacher marking scheme, including method marks and labelled subparts. Feedback is a practice estimate.',
            // The learner already holds this submitted paper, so marking draws on the global budget only.
            { userId: attempt.studentId, relatedEntityId: id, budget: 'granted' },
          )
          if (
            marked.length !== batch.length ||
            new Set(marked.map((g) => g.id)).size !== batch.length ||
            marked.some((g) => !batch.some((q) => q.id === g.id))
          )
            throw new Error('Incomplete written grading response')
          gradingMeta = { model, promptVersion }
          grades.push(...marked)
          const result = {
            ...markWaec(questions, sections, attempt.selectedQuestions, answers, grades, true),
            writtenGrades: grades,
            grading: gradingRecord(gradingMeta),
          }
          const saved = await this.prisma.examMockAttempt.updateMany({
            where: { id, status: 'SUBMITTED', gradingLeaseUntil: lease },
            data: { result: result as unknown as Prisma.InputJsonValue },
          })
          if (!saved.count) return
        }
        const result = {
          ...markWaec(questions, sections, attempt.selectedQuestions, answers, grades, false),
          writtenGrades: grades,
          grading: gradingRecord(gradingMeta),
        }
        await this.prisma.examMockAttempt.updateMany({
          where: { id, status: 'SUBMITTED', gradingLeaseUntil: lease },
          data: {
            status: 'GRADED',
            gradingLeaseUntil: null,
            gradingNextAt: null,
            result: result as unknown as Prisma.InputJsonValue,
          },
        })
      } catch (err) {
        if (err instanceof AiPausedException) {
          // Paused AI (kill switch or global budget) is an operator decision, not a
          // marking failure: keep partial grades, refund the attempt and retry later.
          await this.prisma.examMockAttempt.updateMany({
            where: { id, status: 'SUBMITTED', gradingLeaseUntil: lease },
            data: {
              gradingLeaseUntil: null,
              gradingAttempts: { decrement: 1 },
              gradingNextAt: new Date(Date.now() + 5 * 60000),
              result: {
                ...markWaec(questions, sections, attempt.selectedQuestions, answers, grades, true),
                writtenGrades: grades,
                grading: gradingRecord(gradingMeta),
                gradingDeferred: true,
              } as unknown as Prisma.InputJsonValue,
            },
          })
          this.logger.warn(`event=written_marking_deferred attemptId=${id} reason=ai_paused`)
          return
        }
        const exhausted = attempt.gradingAttempts >= 3
        const result = {
          ...markWaec(questions, sections, attempt.selectedQuestions, answers, grades, !exhausted),
          writtenGrades: grades,
          grading: gradingRecord(gradingMeta),
          gradingFailed: exhausted,
        }
        await this.prisma.examMockAttempt.updateMany({
          where: { id, status: 'SUBMITTED', gradingLeaseUntil: lease },
          data: {
            status: exhausted ? 'GRADED' : 'SUBMITTED',
            gradingLeaseUntil: null,
            gradingNextAt: exhausted ? null : new Date(Date.now() + 60000),
            result: result as unknown as Prisma.InputJsonValue,
          },
        })
        this.logger.warn(
          `event=${exhausted ? 'written_marking_failed' : 'written_marking_retry'} attemptId=${id} attempt=${attempt.gradingAttempts} reason=${err instanceof Error ? err.message.slice(0, 200) : 'provider error'}`,
        )
      }
    } catch (err) {
      this.logger.warn(
        `event=written_marking_recovery attemptId=${id} reason=${err instanceof Error ? err.message : 'database error'}`,
      )
    } finally {
      this.leases.delete(id)
    }
  }
  private async sweep() {
    if (this.sweeping || this.stopping) return
    this.sweeping = true
    try {
      const expired = await this.prisma.examMockAttempt.findMany({
        where: { status: 'IN_PROGRESS', expiresAt: { lte: new Date() } },
        take: 100,
        select: { id: true },
      })
      for (const attempt of expired) {
        if (this.stopping) return
        await this.finish(attempt.id, true)
      }
      const pending = await this.prisma.examMockAttempt.findMany({
        where: {
          status: 'SUBMITTED',
          waecPaperId: { not: null },
          gradingNextAt: { lte: new Date() },
          OR: [{ gradingLeaseUntil: null }, { gradingLeaseUntil: { lt: new Date() } }],
        },
        take: 10,
        select: { id: true },
      })
      // A few papers at a time: marking is AI-latency bound (seconds per paper), so strictly
      // sequential processing left a class's submissions queued for minutes.
      for (let i = 0; i < pending.length && !this.stopping; i += MARKING_CONCURRENCY)
        await Promise.all(pending.slice(i, i + MARKING_CONCURRENCY).map((a) => this.gradeWaec(a.id)))
    } catch (err) {
      this.logger.warn(
        `Mock expiry sweep will retry: ${err instanceof Error ? err.message : 'database error'}`,
      )
    } finally {
      this.sweeping = false
    }
  }
}
