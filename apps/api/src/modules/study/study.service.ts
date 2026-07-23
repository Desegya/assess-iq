import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CoursesService } from '../courses/courses.service'
import { AiService } from '../ai/ai.service'
import { AuthUser, QuestionType } from '@assessiq/types'
import { SetAvailabilityDto } from './dto/set-availability.dto'
import { GeneratePlanDto } from './dto/generate-plan.dto'
import { CompleteSessionDto } from './dto/complete-session.dto'
import { GenerateQuizDto } from './dto/generate-quiz.dto'
import { SubmitQuizDto } from './dto/submit-quiz.dto'

const DEFAULT_TOPIC_MINUTES = 45
const WEAK_TOPIC_THRESHOLD = 60

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function minutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return (eh! * 60 + em!) - (sh! * 60 + sm!)
}

interface DatedSlot {
  date: Date
  startTime: string
  endTime: string
  capacityMinutes: number
}

@Injectable()
export class StudyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly ai: AiService,
  ) {}

  // ─── Availability ─────────────────────────────────────────────────────────

  async getAvailability(user: AuthUser) {
    return this.prisma.studyAvailability.findMany({
      where: { studentId: user.id },
      orderBy: { dayOfWeek: 'asc' },
    })
  }

  async setAvailability(dto: SetAvailabilityDto, user: AuthUser) {
    await this.prisma.$transaction([
      this.prisma.studyAvailability.deleteMany({ where: { studentId: user.id } }),
      this.prisma.studyAvailability.createMany({
        data: dto.slots.map(s => ({
          studentId: user.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          maxMinutes: s.maxMinutes,
        })),
      }),
    ])
    return this.getAvailability(user)
  }

  // ─── Plan generation ──────────────────────────────────────────────────────

  async generatePlan(dto: GeneratePlanDto, user: AuthUser) {
    await this.coursesService.findOne(dto.courseId, user) // access check (throws if inaccessible)

    const examDate = startOfDay(new Date(dto.examDate))
    const today = startOfDay(new Date())
    if (examDate <= today) {
      throw new BadRequestException('Exam date must be in the future')
    }

    const topics = await this.prisma.topic.findMany({
      where: { courseId: dto.courseId },
      orderBy: { order: 'asc' },
    })
    if (topics.length === 0) {
      throw new BadRequestException('This course has no topics yet — add topics before generating a plan')
    }

    const availability = await this.prisma.studyAvailability.findMany({
      where: { studentId: user.id, active: true },
    })
    if (availability.length === 0) {
      throw new BadRequestException('Set your weekly study availability before generating a plan')
    }

    const availabilityByDay = new Map<number, (typeof availability)[number]>()
    for (const slot of availability) {
      if (!availabilityByDay.has(slot.dayOfWeek)) availabilityByDay.set(slot.dayOfWeek, slot)
    }

    // Expand the availability pattern into concrete dated slots up to (not including) the exam date
    const datedSlots: DatedSlot[] = []
    for (const d = new Date(today); d < examDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const slot = availabilityByDay.get(d.getUTCDay())
      if (!slot) continue
      datedSlots.push({
        date: new Date(d),
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacityMinutes: slot.maxMinutes ?? minutesBetween(slot.startTime, slot.endTime),
      })
    }
    if (datedSlots.length === 0) {
      throw new BadRequestException(
        'No available study slots before the exam date — widen your availability or move the exam date',
      )
    }

    // Reserve the last slot as revision/buffer, if there's more than one
    const revisionSlot = datedSlots.length > 1 ? datedSlots.pop()! : undefined

    const sessionsToCreate: {
      scheduledDate: Date
      startTime: string
      endTime: string
      estimatedMinutes: number
      topicId: string | null
    }[] = []

    let slotIndex = 0
    let remainingInSlot = datedSlots[0]?.capacityMinutes ?? 0

    for (const topic of topics) {
      let remainingForTopic = topic.estimatedMinutes ?? DEFAULT_TOPIC_MINUTES

      while (remainingForTopic > 0 && slotIndex < datedSlots.length) {
        if (remainingInSlot <= 0) {
          slotIndex += 1
          if (slotIndex >= datedSlots.length) break
          remainingInSlot = datedSlots[slotIndex]!.capacityMinutes
        }
        const slot = datedSlots[slotIndex]!
        const chunk = Math.min(remainingForTopic, remainingInSlot)
        sessionsToCreate.push({
          scheduledDate: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          estimatedMinutes: chunk,
          topicId: topic.id,
        })
        remainingForTopic -= chunk
        remainingInSlot -= chunk
      }
      // Best-effort: if slots run out before all topics are placed, remaining topics are simply left unscheduled.
    }

    if (revisionSlot) {
      sessionsToCreate.push({
        scheduledDate: revisionSlot.date,
        startTime: revisionSlot.startTime,
        endTime: revisionSlot.endTime,
        estimatedMinutes: revisionSlot.capacityMinutes,
        topicId: null,
      })
    }

    // A fresh plan supersedes any previous active plan for this course
    await this.prisma.studyPlan.updateMany({
      where: { studentId: user.id, courseId: dto.courseId, status: 'ACTIVE' },
      data: { status: 'ABANDONED' },
    })
    const priorVersions = await this.prisma.studyPlan.count({
      where: { studentId: user.id, courseId: dto.courseId },
    })

    return this.prisma.studyPlan.create({
      data: {
        studentId: user.id,
        courseId: dto.courseId,
        examDate,
        status: 'ACTIVE',
        version: priorVersions + 1,
        sessions: {
          create: sessionsToCreate.map(s => ({
            studentId: user.id,
            courseId: dto.courseId,
            topicId: s.topicId,
            scheduledDate: s.scheduledDate,
            startTime: s.startTime,
            endTime: s.endTime,
            estimatedMinutes: s.estimatedMinutes,
          })),
        },
      },
      include: { sessions: { orderBy: { scheduledDate: 'asc' }, include: { topic: true } } },
    })
  }

  async getCurrentPlan(courseId: string, user: AuthUser) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { studentId: user.id, courseId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      include: { sessions: { orderBy: { scheduledDate: 'asc' }, include: { topic: true } } },
    })
    if (!plan) throw new NotFoundException('No active study plan for this course')
    return plan
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getTodaySessions(user: AuthUser) {
    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    return this.prisma.studySession.findMany({
      where: { studentId: user.id, scheduledDate: { gte: today, lt: tomorrow } },
      include: { topic: true, course: { select: { id: true, title: true } } },
      orderBy: { startTime: 'asc' },
    })
  }

  async completeSession(id: string, dto: CompleteSessionDto, user: AuthUser) {
    const session = await this.prisma.studySession.findUnique({ where: { id } })
    if (!session || session.studentId !== user.id) throw new NotFoundException('Session not found')

    const updated = await this.prisma.studySession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualMinutes: dto.actualMinutes ?? session.estimatedMinutes,
        confidenceRating: dto.confidenceRating,
      },
    })

    if (session.topicId) {
      await this.prisma.topicMastery.upsert({
        where: { studentId_topicId: { studentId: user.id, topicId: session.topicId } },
        create: { studentId: user.id, topicId: session.topicId, lastAssessedAt: new Date() },
        update: { lastAssessedAt: new Date() },
      })
    }

    return updated
  }

  async redistribute(planId: string, user: AuthUser) {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { id: planId },
      include: { sessions: true },
    })
    if (!plan || plan.studentId !== user.id) throw new NotFoundException('Study plan not found')

    const today = startOfDay(new Date())
    const missed = plan.sessions.filter(s => s.status === 'NOT_STARTED' && s.scheduledDate < today)
    if (missed.length === 0) {
      return { message: 'No missed sessions to redistribute', createdCount: 0 }
    }

    const availability = await this.prisma.studyAvailability.findMany({
      where: { studentId: user.id, active: true },
    })
    const availabilityByDay = new Map<number, (typeof availability)[number]>()
    for (const slot of availability) {
      if (!availabilityByDay.has(slot.dayOfWeek)) availabilityByDay.set(slot.dayOfWeek, slot)
    }

    const lastScheduled = plan.sessions.reduce(
      (max, s) => (s.scheduledDate > max ? s.scheduledDate : max),
      today,
    )
    const cursor = new Date(lastScheduled)
    cursor.setUTCDate(cursor.getUTCDate() + 1)

    const newSessions: {
      scheduledDate: Date
      startTime: string
      endTime: string
      estimatedMinutes: number
      topicId: string | null
    }[] = []

    for (const session of missed) {
      let daysChecked = 0
      while (!availabilityByDay.has(cursor.getUTCDay()) && daysChecked < 30) {
        cursor.setUTCDate(cursor.getUTCDate() + 1)
        daysChecked += 1
      }
      const slot = availabilityByDay.get(cursor.getUTCDay())
      if (!slot) break // no availability configured — nothing more we can do

      newSessions.push({
        scheduledDate: new Date(cursor),
        startTime: slot.startTime,
        endTime: slot.endTime,
        estimatedMinutes: session.estimatedMinutes,
        topicId: session.topicId,
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    await this.prisma.studySession.updateMany({
      where: { id: { in: missed.map(m => m.id) } },
      data: { status: 'RESCHEDULED' },
    })

    const created = await this.prisma.$transaction(
      newSessions.map(s =>
        this.prisma.studySession.create({
          data: {
            studyPlanId: plan.id,
            studentId: user.id,
            courseId: plan.courseId,
            topicId: s.topicId,
            scheduledDate: s.scheduledDate,
            startTime: s.startTime,
            endTime: s.endTime,
            estimatedMinutes: s.estimatedMinutes,
          },
        }),
      ),
    )

    return { message: `Redistributed ${created.length} missed session(s)`, sessions: created }
  }

  // ─── Self-quizzes ─────────────────────────────────────────────────────────

  async generateQuiz(topicId: string, dto: GenerateQuizDto, user: AuthUser) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) throw new NotFoundException('Topic not found')
    await this.coursesService.findOne(topic.courseId, user) // access check

    // Prefer a ready, extracted document for this course as grounding; fall back to the topic itself
    const doc = await this.prisma.document.findFirst({
      where: { courseId: topic.courseId, status: 'READY', extractedText: { not: null } },
      orderBy: { createdAt: 'desc' },
    })
    const sourceText = doc?.extractedText || `${topic.name}\n${topic.description ?? ''}`
    if (!sourceText.trim()) {
      throw new BadRequestException(
        'No material available to generate a quiz from — upload a document or add a topic description first',
      )
    }

    const raw = await this.ai.generateQuestions(sourceText, {
      count: dto.count,
      types: [QuestionType.MCQ, QuestionType.TRUE_FALSE],
      difficulty: dto.difficulty,
      topicHint: topic.name,
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      documentId: doc?.id ?? topic.id,
    })

    const saved = await Promise.all(
      raw.map(q =>
        this.prisma.question.create({
          data: {
            organizationId: user.organizationId ?? null,
            createdById: user.id,
            topicId: topic.id,
            courseId: topic.courseId,
            sourceDocumentId: doc?.id ?? null,
            questionText: q.questionText,
            questionType: q.type as QuestionType,
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? null,
            difficulty: dto.difficulty,
            status: 'APPROVED', // self-quizzes are student-initiated and formative — no teacher review needed
            isAiGenerated: true,
            tags: ['nightklass-self-quiz'],
          },
        }),
      ),
    )

    // Never expose the answer key before submission
    return saved.map(({ correctAnswer: _correctAnswer, explanation: _explanation, ...q }) => q)
  }

  async submitQuiz(topicId: string, dto: SubmitQuizDto, user: AuthUser) {
    const questions = await this.prisma.question.findMany({
      where: { id: { in: dto.answers.map(a => a.questionId) }, topicId, createdById: user.id },
    })
    if (questions.length === 0) throw new NotFoundException('Quiz questions not found')

    const byId = new Map(questions.map(q => [q.id, q]))
    let gradable = 0
    let correctCount = 0

    const results = dto.answers.map(a => {
      const q = byId.get(a.questionId)
      if (!q) return { questionId: a.questionId, isCorrect: null, correctAnswer: null, explanation: null }

      const isObjective = q.questionType === 'MCQ' || q.questionType === 'TRUE_FALSE'
      const isCorrect = isObjective ? a.selectedAnswer === q.correctAnswer : null
      if (isObjective) {
        gradable += 1
        if (isCorrect) correctCount += 1
      }

      return { questionId: a.questionId, isCorrect, correctAnswer: q.correctAnswer, explanation: q.explanation }
    })

    const scorePercent = gradable > 0 ? Math.round((correctCount / gradable) * 100) : null

    if (scorePercent !== null) {
      const existing = await this.prisma.topicMastery.findUnique({
        where: { studentId_topicId: { studentId: user.id, topicId } },
      })
      const newAverage =
        existing?.quizAverage != null ? Math.round((existing.quizAverage + scorePercent) / 2) : scorePercent

      await this.prisma.topicMastery.upsert({
        where: { studentId_topicId: { studentId: user.id, topicId } },
        create: {
          studentId: user.id,
          topicId,
          quizAverage: newAverage,
          masteryScore: newAverage,
          revisionCount: 1,
          lastAssessedAt: new Date(),
        },
        update: {
          quizAverage: newAverage,
          masteryScore: newAverage,
          revisionCount: { increment: 1 },
          lastAssessedAt: new Date(),
        },
      })
    }

    return { scorePercent, results }
  }

  // ─── Weak topics ──────────────────────────────────────────────────────────

  async getWeakTopics(user: AuthUser) {
    return this.prisma.topicMastery.findMany({
      where: { studentId: user.id, masteryScore: { lt: WEAK_TOPIC_THRESHOLD } },
      include: { topic: { select: { id: true, name: true, courseId: true } } },
      orderBy: { masteryScore: 'asc' },
    })
  }
}
