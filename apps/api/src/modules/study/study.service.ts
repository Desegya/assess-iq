import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CoursesService } from '../courses/courses.service'
import { AiService, type RawGeneratedQuestion, type RawFlashcard, type ChatMessage } from '../ai/ai.service'
import { QUESTION_BANK, scoreQuestion, buildTemplateQuestions } from '../questions/question-bank'
import { AuthUser, QuestionType } from '@assessiq/types'
import { SetAvailabilityDto } from './dto/set-availability.dto'
import { GeneratePlanDto } from './dto/generate-plan.dto'
import { CompleteSessionDto } from './dto/complete-session.dto'
import { GenerateQuizDto } from './dto/generate-quiz.dto'
import { SubmitQuizDto } from './dto/submit-quiz.dto'
import { GenerateFlashcardsDto } from './dto/generate-flashcards.dto'
import { ReviewFlashcardDto, type FlashcardRating } from './dto/review-flashcard.dto'
import { ChatDto } from './dto/chat.dto'

const DEFAULT_TOPIC_MINUTES = 45
const WEAK_TOPIC_THRESHOLD = 60

const SEMESTER_LABEL = { FIRST: 'first semester', SECOND: 'second semester' } as const

// A plain-text description of a course, used as the AI's only context when the student hasn't uploaded material
function describeCourse(course: {
  title: string
  subject: string
  courseCode?: string | null
  level?: number | null
  semester?: 'FIRST' | 'SECOND' | null
  description?: string | null
}): string {
  const details = [
    course.courseCode,
    course.subject,
    course.level ? `${course.level} level` : null,
    course.semester ? SEMESTER_LABEL[course.semester] : null,
  ].filter(Boolean)
  return `${course.title}${details.length ? ` (${details.join(', ')})` : ''} — a university course${
    course.description ? `\nDescription: ${course.description}` : ''
  }`
}

const RATING_QUALITY: Record<FlashcardRating, number> = { again: 2, hard: 3, good: 4, easy: 5 }

function applySm2(
  card: { repetitions: number; easeFactor: number; intervalDays: number },
  quality: number,
): { repetitions: number; easeFactor: number; intervalDays: number; dueDate: Date } {
  let repetitions = card.repetitions
  let intervalDays = card.intervalDays

  if (quality < 3) {
    repetitions = 0
    intervalDays = 1
  } else {
    if (repetitions === 0) intervalDays = 1
    else if (repetitions === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * card.easeFactor)
    repetitions += 1
  }

  const easeFactor = Math.max(1.3, card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

  const dueDate = new Date()
  dueDate.setUTCDate(dueDate.getUTCDate() + intervalDays)

  return { repetitions, easeFactor, intervalDays, dueDate }
}

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
  private readonly logger = new Logger(StudyService.name)

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
        completedAt: new Date(),
      },
    })

    if (session.topicId) {
      // Only touch an existing mastery record — don't create one from mere study time.
      // Mastery is only meaningful once a quiz has produced a real score (see submitQuiz).
      await this.prisma.topicMastery.updateMany({
        where: { studentId: user.id, topicId: session.topicId },
        data: { lastAssessedAt: new Date() },
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
    const course = await this.prisma.course.findUniqueOrThrow({ where: { id: topic.courseId } })
    const sourceText =
      doc?.extractedText ||
      `${describeCourse(course)}\nTopic: ${topic.name}${topic.description ? ` — ${topic.description}` : ''}`

    // Try AI generation first; fall back to a local question bank if AI is
    // unavailable (no/invalid API key) or fails, so this never hard-blocks a
    // student — it just quietly degrades until a real key is configured.
    let raw: RawGeneratedQuestion[]
    let isAiGenerated = true
    try {
      raw = await this.ai.generateQuestions(sourceText, {
        count: dto.count,
        types: [QuestionType.MCQ, QuestionType.TRUE_FALSE],
        difficulty: dto.difficulty,
        topicHint: topic.name,
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        documentId: doc?.id ?? topic.id,
        groundedInMaterial: !!doc,
      })
    } catch (err) {
      this.logger.warn(
        `AI quiz generation failed for topic ${topicId}, using fallback question bank: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      isAiGenerated = false
      const searchTerms = topic.name.toLowerCase().split(/\s+/)
      const scored = QUESTION_BANK.filter(q => q.type === 'MCQ' || q.type === 'TRUE_FALSE')
        .map(q => ({ q, score: scoreQuestion(q, searchTerms) }))
        .sort((a, b) => b.score - a.score || Math.random() - 0.5)
      const picked = scored.slice(0, dto.count).map(s => s.q)
      const shortfall = dto.count - picked.length
      if (shortfall > 0) {
        picked.push(...buildTemplateQuestions(topic.name, ['MCQ', 'TRUE_FALSE'], dto.difficulty, shortfall))
      }
      raw = picked.map(q => ({
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      }))
    }

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
            isAiGenerated,
            tags: isAiGenerated ? ['nightklass-self-quiz'] : ['nightklass-self-quiz', 'fallback'],
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
      where: {
        studentId: user.id,
        quizAverage: { not: null }, // only topics that have actually been quizzed
        masteryScore: { lt: WEAK_TOPIC_THRESHOLD },
      },
      include: { topic: { select: { id: true, name: true, courseId: true } } },
      orderBy: { masteryScore: 'asc' },
    })
  }

  // ─── Flashcards ───────────────────────────────────────────────────────────

  async generateFlashcards(topicId: string, dto: GenerateFlashcardsDto, user: AuthUser) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) throw new NotFoundException('Topic not found')
    await this.coursesService.findOne(topic.courseId, user) // access check

    const doc = await this.prisma.document.findFirst({
      where: { courseId: topic.courseId, status: 'READY', extractedText: { not: null } },
      orderBy: { createdAt: 'desc' },
    })
    const course = await this.prisma.course.findUniqueOrThrow({ where: { id: topic.courseId } })
    const sourceText =
      doc?.extractedText ||
      `${describeCourse(course)}\nTopic: ${topic.name}${topic.description ? ` — ${topic.description}` : ''}`

    let raw: RawFlashcard[]
    try {
      raw = await this.ai.generateFlashcards(sourceText, {
        count: dto.count,
        topicHint: topic.name,
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        documentId: doc?.id ?? topic.id,
        groundedInMaterial: !!doc,
      })
    } catch (err) {
      this.logger.warn(
        `AI flashcard generation failed for topic ${topicId}, using fallback question bank: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      const searchTerms = topic.name.toLowerCase().split(/\s+/)
      const scored = QUESTION_BANK.map(q => ({ q, score: scoreQuestion(q, searchTerms) }))
        .sort((a, b) => b.score - a.score || Math.random() - 0.5)
      const picked = scored.slice(0, dto.count).map(s => s.q)
      const shortfall = dto.count - picked.length
      if (shortfall > 0) {
        picked.push(...buildTemplateQuestions(topic.name, ['SHORT_ANSWER'], 'MEDIUM', shortfall))
      }
      raw = picked.map(q => {
        // For MCQ/TRUE_FALSE bank questions, correctAnswer is just an option key (e.g. "C") —
        // resolve it to the actual answer text so the flashcard back is self-contained.
        const resolvedAnswer = q.options?.find(o => o.key === q.correctAnswer)?.text ?? q.correctAnswer
        return {
          front: q.questionText,
          back: q.explanation ? `${resolvedAnswer} — ${q.explanation}` : resolvedAnswer,
        }
      })
    }

    return Promise.all(
      raw.map(c =>
        this.prisma.flashcard.create({
          data: {
            organizationId: user.organizationId ?? null,
            studentId: user.id,
            topicId: topic.id,
            courseId: topic.courseId,
            documentId: doc?.id ?? null,
            front: c.front,
            back: c.back,
          },
        }),
      ),
    )
  }

  async getDueFlashcards(user: AuthUser, courseId?: string) {
    return this.prisma.flashcard.findMany({
      where: {
        studentId: user.id,
        dueDate: { lte: new Date() },
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: { topic: { select: { id: true, name: true } }, course: { select: { id: true, title: true } } },
    })
  }

  async listFlashcards(user: AuthUser, courseId?: string) {
    return this.prisma.flashcard.findMany({
      where: { studentId: user.id, ...(courseId ? { courseId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { topic: { select: { id: true, name: true } } },
    })
  }

  async reviewFlashcard(id: string, dto: ReviewFlashcardDto, user: AuthUser) {
    const card = await this.prisma.flashcard.findUnique({ where: { id } })
    if (!card || card.studentId !== user.id) throw new NotFoundException('Flashcard not found')

    const quality = RATING_QUALITY[dto.rating]
    const { repetitions, easeFactor, intervalDays, dueDate } = applySm2(card, quality)

    return this.prisma.flashcard.update({
      where: { id },
      data: { repetitions, easeFactor, intervalDays, dueDate, lastReviewedAt: new Date() },
    })
  }

  async removeFlashcard(id: string, user: AuthUser) {
    const card = await this.prisma.flashcard.findUnique({ where: { id } })
    if (!card || card.studentId !== user.id) throw new NotFoundException('Flashcard not found')

    await this.prisma.flashcard.delete({ where: { id } })
    return { message: 'Flashcard deleted' }
  }

  // ─── Progress & streaks ───────────────────────────────────────────────────

  async getProgress(user: AuthUser) {
    const completedSessions = await this.prisma.studySession.findMany({
      where: { studentId: user.id, completedAt: { not: null } },
      select: { completedAt: true, topicId: true, courseId: true },
    })

    const dateKeys = new Set(completedSessions.map(s => startOfDay(s.completedAt!).toISOString()))
    const sortedDates = [...dateKeys].map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime())

    const today = startOfDay(new Date())
    const yesterday = new Date(today)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)

    let currentStreak = 0
    if (
      sortedDates.length > 0 &&
      (sortedDates[0]!.getTime() === today.getTime() || sortedDates[0]!.getTime() === yesterday.getTime())
    ) {
      currentStreak = 1
      let cursor = sortedDates[0]!
      for (let i = 1; i < sortedDates.length; i++) {
        const expectedPrev = new Date(cursor)
        expectedPrev.setUTCDate(expectedPrev.getUTCDate() - 1)
        if (sortedDates[i]!.getTime() === expectedPrev.getTime()) {
          currentStreak += 1
          cursor = sortedDates[i]!
        } else break
      }
    }

    let longestStreak = 0
    let run = 0
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        run = 1
      } else {
        const expectedPrev = new Date(sortedDates[i - 1]!)
        expectedPrev.setUTCDate(expectedPrev.getUTCDate() - 1)
        run = sortedDates[i]!.getTime() === expectedPrev.getTime() ? run + 1 : 1
      }
      longestStreak = Math.max(longestStreak, run)
    }

    const countByDate = new Map<string, number>()
    for (const s of completedSessions) {
      const key = startOfDay(s.completedAt!).toISOString().slice(0, 10)
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1)
    }
    const last30Days: { date: string; completedCount: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() - i)
      const key = d.toISOString().slice(0, 10)
      last30Days.push({ date: key, completedCount: countByDate.get(key) ?? 0 })
    }

    const courses = await this.prisma.course.findMany({
      where: user.organizationId ? { organizationId: user.organizationId } : { ownerId: user.id },
      include: { topics: { select: { id: true } } },
    })

    const completedTopicIdsByCourse = new Map<string, Set<string>>()
    for (const s of completedSessions) {
      if (!s.topicId) continue
      if (!completedTopicIdsByCourse.has(s.courseId)) completedTopicIdsByCourse.set(s.courseId, new Set())
      completedTopicIdsByCourse.get(s.courseId)!.add(s.topicId)
    }

    const courseProgress = courses.map(c => {
      const total = c.topics.length
      const completed = completedTopicIdsByCourse.get(c.id)?.size ?? 0
      return {
        courseId: c.id,
        title: c.title,
        topicsTotal: total,
        topicsCompleted: completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    })

    return { currentStreak, longestStreak, last30Days, courses: courseProgress }
  }

  // ─── Topic suggestions & notes without uploaded material ──────────────────

  async suggestTopics(courseId: string, user: AuthUser) {
    const course = await this.coursesService.findOne(courseId, user) // access check
    try {
      const proposals = await this.ai.suggestCourseTopics(describeCourse(course), {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        relatedEntityId: courseId,
      })
      return { source: 'ai' as const, proposals }
    } catch (err) {
      this.logger.warn(
        `AI topic suggestion failed for course ${courseId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw new BadRequestException("Couldn't suggest topics right now — try again in a moment, or add them yourself")
    }
  }

  async getTopicNotes(topicId: string, user: AuthUser) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) throw new NotFoundException('Topic not found')
    const course = await this.coursesService.findOne(topic.courseId, user) // access check
    return {
      topic: { id: topic.id, name: topic.name, courseId: course.id, courseTitle: course.title },
      notes: topic.notes,
      notesGeneratedAt: topic.notesGeneratedAt,
    }
  }

  async generateTopicNotes(topicId: string, user: AuthUser) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) throw new NotFoundException('Topic not found')
    const course = await this.coursesService.findOne(topic.courseId, user) // access check

    const doc = await this.prisma.document.findFirst({
      where: { courseId: topic.courseId, status: 'READY', extractedText: { not: null } },
      orderBy: { createdAt: 'desc' },
    })

    let notes: string
    try {
      notes = await this.ai.generateTopicNotes(describeCourse(course), topic.name, doc?.extractedText ?? null, {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        relatedEntityId: topic.id,
      })
    } catch (err) {
      this.logger.warn(
        `AI notes generation failed for topic ${topicId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw new BadRequestException("Couldn't generate notes right now — try again in a moment")
    }

    const updated = await this.prisma.topic.update({
      where: { id: topic.id },
      data: { notes, notesGeneratedAt: new Date() },
    })
    return {
      topic: { id: topic.id, name: topic.name, courseId: course.id, courseTitle: course.title },
      notes: updated.notes,
      notesGeneratedAt: updated.notesGeneratedAt,
      groundedInMaterial: !!doc,
    }
  }

  // ─── AI study chat ────────────────────────────────────────────────────────

  async chat(courseId: string, dto: ChatDto, user: AuthUser) {
    const course = await this.coursesService.findOne(courseId, user) // access check

    const docs = await this.prisma.document.findMany({
      where: { courseId, status: 'READY', extractedText: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })
    const combinedText = docs.map(d => d.extractedText).join('\n\n').slice(0, 12000)
    const topicNames = course.topics.map((t: { name: string }) => t.name).join(', ')
    const hasMaterial = !!combinedText.trim()

    const systemContext = hasMaterial
      ? `You are a friendly, encouraging study tutor helping a student with their course "${course.title}" (${course.subject}).
Topics in this course: ${topicNames || 'none listed yet'}.

Answer the student's questions using ONLY the course material provided below. If the answer isn't in the
material, say so clearly rather than guessing. Keep answers concise and easy to understand.

COURSE MATERIAL:
${combinedText}`
      : `You are a friendly, encouraging study tutor helping a student with this course:
${describeCourse(course)}
Topics the student has added: ${topicNames || 'none yet'}.

The student hasn't uploaded slides or notes yet, so answer from your own knowledge of how this course is
typically taught at university level. When asked for topics, notes, summaries or practice questions, produce
them. Keep answers clear, accurate and easy to understand, and be honest when you're unsure.`

    const messages: ChatMessage[] = [...(dto.history ?? []), { role: 'user', content: dto.message }]

    try {
      const reply = await this.ai.chat(messages, systemContext, {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        relatedEntityId: courseId,
      })
      return { source: hasMaterial ? ('ai' as const) : ('general' as const), reply }
    } catch (err) {
      this.logger.warn(
        `AI chat failed for course ${courseId}, using fallback keyword search: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      if (!hasMaterial) {
        return {
          source: 'fallback' as const,
          reply: "AI isn't available right now. Try again in a moment, or upload your course material so I can search it.",
        }
      }
      return { source: 'fallback' as const, reply: this.keywordSearchFallback(dto.message, combinedText) }
    }
  }

  private keywordSearchFallback(question: string, text: string): string {
    const terms = question.toLowerCase().split(/\W+/).filter(t => t.length > 3)
    const sentences = text.split(/(?<=[.!?])\s+/)
    const scored = sentences
      .map(s => ({ s, score: terms.filter(t => s.toLowerCase().includes(t)).length }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) {
      return "AI isn't available right now, and I couldn't find anything matching that in your uploaded materials — try rephrasing, or check back once AI is configured."
    }

    const best = scored.slice(0, 3).map(x => x.s.trim()).join(' ')
    return `AI isn't available right now — here's a basic search of your notes:\n\n${best}`
  }
}
