import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { StartAttemptDto } from './dto/start-attempt.dto'
import { SubmitAnswerDto } from './dto/submit-answer.dto'
import { GradeAnswersDto } from './dto/grade-answers.dto'
import { attemptDeadline, isPastDeadline, orgScope } from '../../common/org-scope'

/** Question types a teacher marks by hand. Everything else is auto-marked on submit. */
const WRITTEN_TYPES = new Set(['SHORT_ANSWER', 'THEORY'])
const FINISHED: ('SUBMITTED' | 'AUTO_SUBMITTED' | 'GRADED')[] = ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED']

type AttemptTiming = {
  startedAt: Date
  assessment: { durationMinutes: number; endTime: Date | null }
}

const deadlineOf = (a: AttemptTiming) =>
  attemptDeadline(a.startedAt, a.assessment.durationMinutes, a.assessment.endTime)

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Start an attempt ──────────────────────────────────────────────────────

  async start(dto: StartAttemptDto, user: AuthUser) {
    // Students only ever take their own organisation's assessments
    if (!user.organizationId) throw new NotFoundException('Assessment not found or not published')

    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: dto.assessmentId,
        organizationId: user.organizationId,
        status: { in: ['PUBLISHED', 'ACTIVE'] },
      },
      select: { id: true, totalQuestions: true, startTime: true, endTime: true, settings: true },
    })

    if (!assessment) {
      throw new NotFoundException('Assessment not found or not published')
    }

    if (assessment.totalQuestions === 0) {
      throw new BadRequestException('This assessment has no questions yet')
    }

    // Resume an unfinished attempt, unless its time ran out while the student was away
    const existing = await this.prisma.attempt.findFirst({
      where: { assessmentId: dto.assessmentId, studentId: user.id, status: 'IN_PROGRESS' },
      include: { assessment: { select: { durationMinutes: true, endTime: true } } },
    })
    if (existing) {
      if (!isPastDeadline(deadlineOf(existing))) return this.findOne(existing.id, user)
      await this.finalize(existing.id, true)
    }

    // Enforce time window
    const now = new Date()
    if (assessment.startTime && now < new Date(assessment.startTime)) {
      const opens = new Date(assessment.startTime).toLocaleString('en-NG', {
        dateStyle: 'medium', timeStyle: 'short',
      })
      throw new BadRequestException(`This assessment hasn't opened yet. It opens on ${opens}.`)
    }
    if (assessment.endTime && now > new Date(assessment.endTime)) {
      throw new BadRequestException('This assessment has closed and is no longer accepting submissions.')
    }

    const settings = assessment.settings as { maxAttempts?: number }
    const maxAttempts = settings?.maxAttempts ?? 1
    const previousAttempts = await this.prisma.attempt.count({
      where: { assessmentId: dto.assessmentId, studentId: user.id, status: { in: FINISHED } },
    })
    if (previousAttempts >= maxAttempts) {
      throw new ConflictException(
        `You have already used all ${maxAttempts} attempt(s) for this assessment`,
      )
    }

    const attempt = await this.prisma.attempt.create({
      data: { assessmentId: dto.assessmentId, studentId: user.id, status: 'IN_PROGRESS' },
    })

    return this.findOne(attempt.id, user)
  }

  // ─── Save / update a single answer ────────────────────────────────────────

  async saveAnswer(attemptId: string, dto: SubmitAnswerDto, user: AuthUser) {
    const attempt = await this.assertAttemptOwner(attemptId, user)

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('This attempt has already been submitted')
    }
    if (isPastDeadline(deadlineOf(attempt))) {
      await this.finalize(attemptId, true)
      throw new BadRequestException('Time is up. Your test has been submitted with the answers saved so far.')
    }

    const onAssessment = await this.prisma.assessmentQuestion.count({
      where: { assessmentId: attempt.assessmentId, questionId: dto.questionId },
    })
    if (!onAssessment) throw new BadRequestException('That question is not part of this assessment')

    return this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      create: {
        attemptId,
        questionId: dto.questionId,
        selectedAnswer: dto.selectedAnswer ?? null,
        textAnswer: dto.textAnswer ?? null,
        timeTakenSeconds: dto.timeTakenSeconds ?? null,
      },
      update: {
        selectedAnswer: dto.selectedAnswer ?? null,
        textAnswer: dto.textAnswer ?? null,
        timeTakenSeconds: dto.timeTakenSeconds ?? null,
      },
      select: { id: true, questionId: true, selectedAnswer: true, textAnswer: true },
    })
  }

  // ─── Submit attempt (grade + finalize) ────────────────────────────────────

  async submit(attemptId: string, user: AuthUser) {
    const attempt = await this.assertAttemptOwner(attemptId, user)

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Attempt already submitted')
    }

    const finished = await this.finalize(attemptId, isPastDeadline(deadlineOf(attempt)))
    if (!finished) throw new BadRequestException('Attempt already submitted')
    return finished
  }

  // ─── My attempts (student) ────────────────────────────────────────────────

  async findMyAttempts(user: AuthUser) {
    await this.expireStale({ studentId: user.id })
    return this.prisma.attempt.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            totalQuestions: true,
            course: { select: { id: true, title: true } },
          },
        },
        _count: { select: { answers: true } },
      },
    })
  }

  // ─── Single attempt (with answers) ───────────────────────────────────────

  async findOne(attemptId: string, user: AuthUser) {
    const isStudent = user.role === UserRole.STUDENT
    // Students see only their own attempts; staff only attempts on their organisation's assessments
    const where = isStudent
      ? { id: attemptId, studentId: user.id }
      : { id: attemptId, assessment: orgScope(user, 'Attempt not found') }

    // Close out an attempt whose time ran out (the student closed the tab, lost power, …)
    const timing = await this.prisma.attempt.findFirst({
      where,
      select: { status: true, startedAt: true, assessment: { select: { durationMinutes: true, endTime: true } } },
    })
    if (!timing) throw new NotFoundException('Attempt not found')
    if (timing.status === 'IN_PROGRESS' && isPastDeadline(deadlineOf(timing))) {
      await this.finalize(attemptId, true)
    }

    const attempt = await this.prisma.attempt.findFirst({
      where,
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            instructions: true,
            durationMinutes: true,
            endTime: true,
            totalQuestions: true,
            totalMarks: true,
            settings: true,
            course: { select: { id: true, title: true } },
            questions: {
              orderBy: { order: 'asc' },
              include: {
                question: {
                  select: {
                    id: true,
                    questionText: true,
                    questionType: true,
                    options: true,
                    difficulty: true,
                    correctAnswer: true,
                    explanation: true,
                  },
                },
              },
            },
          },
        },
        answers: {
          select: {
            id: true,
            questionId: true,
            selectedAnswer: true,
            textAnswer: true,
            isCorrect: true,
            score: true,
            timeTakenSeconds: true,
          },
        },
      },
    })
    if (!attempt) throw new NotFoundException('Attempt not found')

    const deadline = deadlineOf(attempt)
    const timingInfo = { deadline: deadline?.toISOString() ?? null, serverNow: new Date().toISOString() }

    // Students never see the answer key mid-attempt, nor afterwards when the teacher turned review off
    const allowReview = (attempt.assessment.settings as { allowReview?: boolean } | null)?.allowReview !== false
    if (isStudent && (attempt.status === 'IN_PROGRESS' || !allowReview)) {
      return {
        ...attempt,
        ...timingInfo,
        assessment: {
          ...attempt.assessment,
          questions: attempt.assessment.questions.map(aq => ({
            ...aq,
            question: { ...aq.question, correctAnswer: undefined, explanation: undefined },
          })),
        },
        // Mid-attempt, per-answer marks would reveal the key too
        answers:
          attempt.status === 'IN_PROGRESS'
            ? attempt.answers.map(a => ({ ...a, isCorrect: null, score: null }))
            : attempt.answers,
      }
    }

    return { ...attempt, ...timingInfo }
  }

  // ─── Teacher: list attempts for an assessment ─────────────────────────────

  async findByAssessment(assessmentId: string, user: AuthUser) {
    if (user.role === UserRole.STUDENT) throw new ForbiddenException()
    if (!assessmentId) throw new BadRequestException('assessmentId is required')

    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, ...orgScope(user, 'Assessment not found') },
      select: { id: true },
    })
    if (!assessment) throw new NotFoundException('Assessment not found')

    await this.expireStale({ assessmentId })
    return this.prisma.attempt.findMany({
      where: { assessmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true } },
        _count: { select: { answers: true } },
      },
    })
  }

  // ─── Teacher: manually grade open-ended answers ───────────────────────────

  async gradeAnswers(attemptId: string, dto: GradeAnswersDto, user: AuthUser) {
    if (user.role === UserRole.STUDENT) throw new ForbiddenException()

    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, assessment: orgScope(user, 'Attempt not found') },
      select: {
        status: true,
        assessmentId: true,
        answers: { select: { id: true, questionId: true } },
      },
    })
    if (!attempt) throw new NotFoundException('Attempt not found')
    if (attempt.status === 'IN_PROGRESS') {
      throw new BadRequestException('This attempt has not been submitted yet')
    }

    // Every graded answer must belong to this attempt; marks are capped at the question's weight
    const weights = new Map(
      (
        await this.prisma.assessmentQuestion.findMany({
          where: { assessmentId: attempt.assessmentId },
          select: { questionId: true, scoreWeight: true },
        })
      ).map(q => [q.questionId, q.scoreWeight]),
    )
    const answerQuestion = new Map(attempt.answers.map(a => [a.id, a.questionId]))
    for (const g of dto.grades) {
      const questionId = answerQuestion.get(g.answerId)
      if (!questionId) throw new BadRequestException('One or more answers are not part of this attempt')
      const max = weights.get(questionId) ?? 1
      if (g.score > max) throw new BadRequestException(`A score cannot exceed the question's ${max} mark(s)`)
    }

    await this.prisma.$transaction(
      dto.grades.map(g =>
        this.prisma.answer.update({
          where: { id: g.answerId },
          data: { score: g.score, isCorrect: g.score > 0 },
        }),
      ),
    )

    return this.recalculate(attemptId)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertAttemptOwner(attemptId: string, user: AuthUser) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, studentId: user.id },
      include: { assessment: { select: { durationMinutes: true, endTime: true } } },
    })
    if (!attempt) throw new NotFoundException('Attempt not found')
    return attempt
  }

  /**
   * Close an in-progress attempt exactly once and mark what can be marked automatically.
   * Returns null if someone else (a double-click, the auto-submit timer) already closed it.
   */
  private async finalize(attemptId: string, timedOut: boolean) {
    const claimed = await this.prisma.attempt.updateMany({
      where: { id: attemptId, status: 'IN_PROGRESS' },
      data: { status: timedOut ? 'AUTO_SUBMITTED' : 'SUBMITTED', submittedAt: new Date() },
    })
    if (claimed.count === 0) return null

    const [assessmentQuestions, answers] = await Promise.all([
      this.prisma.attempt
        .findUniqueOrThrow({ where: { id: attemptId }, select: { assessmentId: true } })
        .then(({ assessmentId }) =>
          this.prisma.assessmentQuestion.findMany({
            where: { assessmentId },
            include: { question: { select: { correctAnswer: true, questionType: true } } },
          }),
        ),
      this.prisma.answer.findMany({ where: { attemptId } }),
    ])
    const questions = new Map(assessmentQuestions.map(aq => [aq.questionId, aq]))

    const updates = []
    for (const answer of answers) {
      const aq = questions.get(answer.questionId)
      if (!aq) continue
      if (WRITTEN_TYPES.has(aq.question.questionType)) {
        // A blank written answer needs no marking: it earns nothing
        if (!answer.textAnswer?.trim()) {
          updates.push(this.prisma.answer.update({ where: { id: answer.id }, data: { isCorrect: false, score: 0 } }))
        }
        continue
      }
      const isCorrect =
        !!answer.selectedAnswer &&
        answer.selectedAnswer.trim().toUpperCase() === aq.question.correctAnswer.trim().toUpperCase()
      updates.push(
        this.prisma.answer.update({
          where: { id: answer.id },
          data: { isCorrect, score: isCorrect ? aq.scoreWeight : 0 },
        }),
      )
    }
    if (updates.length) await this.prisma.$transaction(updates)

    return this.recalculate(attemptId)
  }

  /**
   * Recompute the attempt's score from its answers. The attempt is GRADED only once
   * every written answer has a mark; until then it stays SUBMITTED / AUTO_SUBMITTED
   * so students and teachers can see that marking is still pending.
   */
  private async recalculate(attemptId: string) {
    const attempt = await this.prisma.attempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        status: true,
        assessment: {
          select: {
            questions: { select: { questionId: true, scoreWeight: true, question: { select: { questionType: true } } } },
          },
        },
        answers: { select: { questionId: true, score: true, textAnswer: true } },
      },
    })
    const totalMarks = attempt.assessment.questions.reduce((sum, q) => sum + q.scoreWeight, 0)
    const written = new Set(
      attempt.assessment.questions.filter(q => WRITTEN_TYPES.has(q.question.questionType)).map(q => q.questionId),
    )
    const earned = attempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0)
    const awaitingMarks = attempt.answers.some(a => written.has(a.questionId) && a.score === null)

    return this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        score: earned,
        percentageScore: totalMarks > 0 ? (earned / totalMarks) * 100 : 0,
        status: awaitingMarks ? (attempt.status === 'GRADED' ? 'SUBMITTED' : attempt.status) : 'GRADED',
      },
    })
  }

  /** Auto-submit any of these in-progress attempts whose time has run out. */
  private async expireStale(where: { studentId?: string; assessmentId?: string }) {
    const open = await this.prisma.attempt.findMany({
      where: { ...where, status: 'IN_PROGRESS' },
      select: { id: true, startedAt: true, assessment: { select: { durationMinutes: true, endTime: true } } },
    })
    for (const attempt of open) {
      if (isPastDeadline(deadlineOf(attempt))) await this.finalize(attempt.id, true)
    }
  }
}
