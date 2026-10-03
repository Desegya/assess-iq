import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CoursesService } from '../courses/courses.service'
import { TopicsService } from '../topics/topics.service'
import { RetrievalService } from '../learning/retrieval.service'
import { describeCourse, SEMESTER_LABEL } from '../courses/describe-course'
import { allocateSlots, buildPlan, type PlanTopic } from './plan-builder'
import { extractTopicsHeuristically } from '../documents/topic-extraction-fallback'
import {
  AiService,
  type WrittenAnswerGrade,
  type RawGeneratedQuestion,
  type RawFlashcard,
  type RawSuggestedCourse,
  type ChatMessage,
} from '../ai/ai.service'
import { QUESTION_BANK, scoreQuestion, buildTemplateQuestions } from '../questions/question-bank'
import { AuthUser, QuestionType, TopicSource } from '@assessiq/types'
import { SetAvailabilityDto } from './dto/set-availability.dto'
import { GeneratePlanDto } from './dto/generate-plan.dto'
import { CompleteSessionDto } from './dto/complete-session.dto'
import { GenerateQuizDto } from './dto/generate-quiz.dto'
import { SubmitQuizDto } from './dto/submit-quiz.dto'
import { GenerateFlashcardsDto } from './dto/generate-flashcards.dto'
import { ReviewFlashcardDto, type FlashcardRating } from './dto/review-flashcard.dto'
import { ChatDto } from './dto/chat.dto'
import { SuggestCoursesDto } from './dto/suggest-courses.dto'

const WEAK_TOPIC_THRESHOLD = 60

// Marks per question type: objective 1, short answer/calculation 2, structured/essay as generated (default 8)
function defaultMarks(type: QuestionType, marks?: number | null): number {
  if (type === QuestionType.THEORY) return marks && marks > 0 ? Math.min(marks, 20) : 8
  if (type === QuestionType.SHORT_ANSWER) return 2
  return 1
}

const DIFFICULTY_STEPS = ['EASY', 'MEDIUM', 'HARD'] as const

// Adaptive difficulty: step up after 80%+, step down below 50%
function recommendDifficulty(current: string, scorePercent: number | null): (typeof DIFFICULTY_STEPS)[number] {
  const i = Math.max(0, DIFFICULTY_STEPS.indexOf(current as (typeof DIFFICULTY_STEPS)[number]))
  if (scorePercent === null) return DIFFICULTY_STEPS[i]!
  if (scorePercent >= 80) return DIFFICULTY_STEPS[Math.min(2, i + 1)]!
  if (scorePercent < 50) return DIFFICULTY_STEPS[Math.max(0, i - 1)]!
  return DIFFICULTY_STEPS[i]!
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
    private readonly topicsService: TopicsService,
    private readonly retrieval: RetrievalService,
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

  // ─── Plan generation & adaptation ─────────────────────────────────────────

  // Concrete dated slots from `from` up to (not including) `until`, following the weekly availability
  private async datedSlots(user: AuthUser, from: Date, until: Date): Promise<DatedSlot[]> {
    const availability = await this.prisma.studyAvailability.findMany({ where: { studentId: user.id, active: true } })
    if (availability.length === 0) {
      throw new BadRequestException('Set your weekly study availability before generating a plan')
    }
    const byDay = new Map<number, (typeof availability)[number]>()
    for (const slot of availability) if (!byDay.has(slot.dayOfWeek)) byDay.set(slot.dayOfWeek, slot)

    const slots: DatedSlot[] = []
    for (const d = new Date(from); d < until; d.setUTCDate(d.getUTCDate() + 1)) {
      const slot = byDay.get(d.getUTCDay())
      if (!slot) continue
      slots.push({
        date: new Date(d),
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacityMinutes: slot.maxMinutes ?? minutesBetween(slot.startTime, slot.endTime),
      })
    }
    return slots
  }

  // Everything the scheduler weighs per topic: size, quiz mastery, self-rated confidence, time already spent
  private async planTopics(courseId: string, user: AuthUser): Promise<PlanTopic[]> {
    const topics = await this.prisma.topic.findMany({
      where: { courseId, parentTopicId: null, archivedAt: null },
      orderBy: { order: 'asc' },
      include: { subTopics: { where: { archivedAt: null }, select: { id: true } } },
    })
    const ids = topics.map(t => t.id)
    const [masteries, completed] = await Promise.all([
      this.prisma.topicMastery.findMany({ where: { studentId: user.id, topicId: { in: ids } } }),
      this.prisma.studySession.findMany({
        where: { studentId: user.id, topicId: { in: ids }, status: 'COMPLETED' },
        select: { topicId: true, kind: true, actualMinutes: true, estimatedMinutes: true, confidenceRating: true },
      }),
    ])
    return topics.map(t => {
      const mine = completed.filter(s => s.topicId === t.id)
      const ratings = mine.map(s => s.confidenceRating).filter((r): r is number => r != null)
      const mastery = masteries.find(m => m.topicId === t.id)
      return {
        id: t.id,
        name: t.name,
        estimatedMinutes: t.estimatedMinutes,
        subtopicCount: t.subTopics.length,
        mastery: mastery?.quizAverage ?? null,
        confidence: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        completedMinutes: mine
          .filter(s => s.kind !== 'REVISION')
          .reduce((sum, s) => sum + (s.actualMinutes ?? s.estimatedMinutes), 0),
      }
    })
  }

  async generatePlan(dto: GeneratePlanDto, user: AuthUser) {
    const course = await this.coursesService.findOne(dto.courseId, user) // access check (throws if inaccessible)

    const today = startOfDay(new Date())
    if (!dto.examDate && !dto.weeks) throw new BadRequestException('Choose an exam date or a plan length')
    const end = dto.weeks
      ? new Date(today.getTime() + dto.weeks * 7 * 24 * 60 * 60 * 1000)
      : startOfDay(new Date(dto.examDate!))
    if (end <= today) throw new BadRequestException('Exam date must be in the future')

    const topicCount = await this.prisma.topic.count({
      where: { courseId: dto.courseId, parentTopicId: null, archivedAt: null },
    })
    if (topicCount === 0) {
      throw new BadRequestException('This course has no topics yet — add topics before generating a plan')
    }
    if ((await this.datedSlots(user, today, end)).length === 0) {
      throw new BadRequestException(
        'No available study slots before the exam date — widen your availability or move the exam date',
      )
    }

    // A fresh plan supersedes any previous active plan for this course
    await this.prisma.studyPlan.updateMany({
      where: { studentId: user.id, courseId: dto.courseId, status: 'ACTIVE' },
      data: { status: 'ABANDONED' },
    })
    const priorVersions = await this.prisma.studyPlan.count({ where: { studentId: user.id, courseId: dto.courseId } })
    const plan = await this.prisma.studyPlan.create({
      data: {
        studentId: user.id,
        courseId: dto.courseId,
        examDate: end,
        status: 'ACTIVE',
        version: priorVersions + 1,
        planType: dto.weeks ? 'DURATION' : 'EXAM_DATE',
        weeks: dto.weeks ?? null,
      },
    })

    // Schedule it alongside the student's other courses so no two plans claim the same time
    const label = course.courseCode ?? course.title
    await this.rebalancePlans(
      user,
      { [plan.id]: dto.weeks ? `${dto.weeks}-week plan created` : 'Plan created for your exam date' },
      `Shared your study time with ${label}`,
    )
    return this.getCurrentPlan(dto.courseId, user)
  }

  async getCurrentPlan(courseId: string, user: AuthUser) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { studentId: user.id, courseId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      include: { sessions: { orderBy: [{ scheduledDate: 'asc' }, { kind: 'asc' }], include: { topic: true } } },
    })
    if (!plan) throw new NotFoundException('No active study plan for this course')

    const today = startOfDay(new Date())
    const latestRevision = await this.prisma.outlineRevision.findFirst({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    return {
      ...plan,
      missedCount: plan.sessions.filter(s => s.status === 'NOT_STARTED' && s.scheduledDate < today).length,
      // The outline was edited after the plan was last (re)built, so sessions may not match the topics
      outlineChanged: !!latestRevision && latestRevision.createdAt > plan.updatedAt,
    }
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

  // Re-plans everything from today: missed sessions, quiz results, confidence, outline edits and exam proximity.
  // All of the student's active plans are rebuilt together so courses never compete for the same slot.
  async adaptPlan(planId: string, user: AuthUser, reason = 'Plan updated') {
    const plan = await this.prisma.studyPlan.findUnique({ where: { id: planId } })
    if (!plan || plan.studentId !== user.id || plan.status !== 'ACTIVE') throw new NotFoundException('Study plan not found')
    if (plan.examDate <= startOfDay(new Date())) throw new BadRequestException('This plan has ended — create a new one')

    await this.rebalancePlans(user, { [plan.id]: reason }, 'Rebalanced with your other courses')
    return this.getCurrentPlan(plan.courseId, user)
  }

  // Rebuilds the upcoming sessions of every active plan from today. Each course gets its own share of each
  // study slot (by credit units, boosted near its exam), so sessions from different courses never overlap.
  // `reasons` holds the change-log line for plans the student acted on; other plans are only touched (and
  // logged with `otherReason`) if their schedule actually changes.
  private async rebalancePlans(user: AuthUser, reasons: Record<string, string>, otherReason: string) {
    const today = startOfDay(new Date())
    const plans = await this.prisma.studyPlan.findMany({
      where: { studentId: user.id, status: 'ACTIVE', examDate: { gt: today } },
      orderBy: { createdAt: 'asc' },
      include: { sessions: true, course: { select: { creditUnits: true } } },
    })
    if (plans.length === 0) return

    const lastEnd = new Date(Math.max(...plans.map(p => p.examDate.getTime())))
    const slots = await this.datedSlots(user, today, lastEnd)
    const DAY = 24 * 60 * 60 * 1000
    const allocation = allocateSlots(
      plans.map(p => ({
        id: p.id,
        end: p.examDate,
        weight: (date: Date) =>
          (p.course.creditUnits || 3) * (p.planType === 'EXAM_DATE' && p.examDate.getTime() - date.getTime() <= 21 * DAY ? 1.5 : 1),
      })),
      slots,
    )

    const signature = (ss: { scheduledDate: Date; startTime: string; estimatedMinutes: number; topicId: string | null; kind: string }[]) =>
      ss
        .map(x => `${x.scheduledDate.toISOString().slice(0, 10)}|${x.startTime}|${x.estimatedMinutes}|${x.topicId}|${x.kind}`)
        .sort()
        .join(';')

    const ops = []
    for (const plan of plans) {
      const missed = plan.sessions.filter(s => s.status === 'NOT_STARTED' && s.scheduledDate < today)
      const upcoming = plan.sessions.filter(s => s.status === 'NOT_STARTED' && s.scheduledDate >= today)
      const topics = await this.planTopics(plan.courseId, user)
      const built = buildPlan(topics, allocation.get(plan.id) ?? [], { planStart: plan.startDate, examDate: plan.examDate })

      const requested = reasons[plan.id]
      if (!requested && missed.length === 0 && signature(upcoming) === signature(built.sessions)) continue

      const previousTopicIds = new Set(plan.sessions.map(s => s.topicId).filter(Boolean))
      const added = plan.sessions.length
        ? topics.filter(t => !previousTopicIds.has(t.id) && built.sessions.some(s => s.topicId === t.id))
        : []
      const weak = topics.filter(t => t.mastery !== null && t.mastery < 50)
      const summary = [
        requested ?? otherReason,
        missed.length && `rescheduled ${missed.length} missed session${missed.length === 1 ? '' : 's'}`,
        added.length && `added ${added.map(t => t.name).join(', ')}`,
        weak.length && `more time for ${weak.map(t => t.name).join(', ')}`,
        built.scaledDown && 'shortened topics to fit the time available',
        built.unscheduledTopics.length && `not enough time for ${built.unscheduledTopics.join(', ')}`,
      ].filter(Boolean) as string[]

      ops.push(
        this.prisma.studySession.updateMany({ where: { id: { in: missed.map(s => s.id) } }, data: { status: 'MISSED' } }),
        this.prisma.studySession.deleteMany({ where: { id: { in: upcoming.map(s => s.id) } } }),
        this.prisma.studySession.createMany({
          data: built.sessions.map(s => ({ ...s, studyPlanId: plan.id, studentId: user.id, courseId: plan.courseId })),
        }),
        this.prisma.studyPlan.update({
          where: { id: plan.id },
          data: {
            changeLog: [...((plan.changeLog as object[]) ?? []), { at: new Date().toISOString(), reason: summary.join('; ') }],
          },
        }),
      )
    }
    if (ops.length) await this.prisma.$transaction(ops)
  }

  // Students often only learn the exam date mid-semester: set or change it, then re-plan the rest around it
  async setExamDate(planId: string, examDate: string, user: AuthUser) {
    const plan = await this.prisma.studyPlan.findUnique({ where: { id: planId } })
    if (!plan || plan.studentId !== user.id || plan.status !== 'ACTIVE') throw new NotFoundException('Study plan not found')
    const date = startOfDay(new Date(examDate))
    if (date <= startOfDay(new Date())) throw new BadRequestException('Exam date must be in the future')

    const changed = plan.planType === 'EXAM_DATE'
    await this.prisma.studyPlan.update({
      where: { id: planId },
      data: { examDate: date, planType: 'EXAM_DATE', weeks: null },
    })
    return this.adaptPlan(
      planId,
      user,
      `Exam date ${changed ? 'changed' : 'set'} to ${date.toDateString()} — plan now ends at your exam`,
    )
  }

  // Kept for existing clients: rescheduling missed sessions is now part of adapting the plan
  async redistribute(planId: string, user: AuthUser) {
    return this.adaptPlan(planId, user, 'Rescheduled missed sessions')
  }

  // Small, immediate adjustments after a quiz (a full re-plan happens on adaptPlan)
  private async adjustPlanAfterQuiz(topicId: string, courseId: string, scorePercent: number, user: AuthUser) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { studentId: user.id, courseId, status: 'ACTIVE' },
      include: { sessions: { where: { topicId, status: 'NOT_STARTED' } } },
    })
    if (!plan) return null
    const topic = await this.prisma.topic.findUniqueOrThrow({ where: { id: topicId } })
    const log = (plan.changeLog as object[]) ?? []
    const today = startOfDay(new Date())

    if (scorePercent < 50) {
      // Poor score: re-plan so this topic gets extra revision time (weak topics are weighted up), sharing
      // time fairly with other courses rather than squeezing a session into someone else's slot
      await this.rebalancePlans(
        user,
        { [plan.id]: `More time for ${topic.name} after a ${scorePercent}% quiz` },
        'Rebalanced with your other courses',
      )
      const next = await this.prisma.studySession.findFirst({
        where: { studyPlanId: plan.id, topicId, status: 'NOT_STARTED', scheduledDate: { gte: today } },
        orderBy: { scheduledDate: 'asc' },
      })
      return next
        ? `We gave ${topic.name} more study time in your plan. Next session: ${next.scheduledDate.toDateString()}, ${next.startTime}.`
        : `We gave ${topic.name} more weight in your plan.`
    }

    const upcomingReviews = plan.sessions.filter(s => s.kind === 'REVIEW')
    if (scorePercent >= 85 && upcomingReviews.length > 0) {
      // Strong score: drop the extra reviews for this topic and move faster
      await this.prisma.$transaction([
        this.prisma.studySession.deleteMany({ where: { id: { in: upcomingReviews.map(s => s.id) } } }),
        this.prisma.studyPlan.update({
          where: { id: plan.id },
          data: { changeLog: [...log, { at: new Date().toISOString(), reason: `Skipped extra reviews for ${topic.name} after a ${scorePercent}% quiz` }] },
        }),
      ])
      return `Great score — we freed up ${upcomingReviews.length * 20} minutes of review time for ${topic.name}.`
    }
    return null
  }

  // ─── Self-quizzes ─────────────────────────────────────────────────────────

  async generateQuiz(topicId: string, dto: GenerateQuizDto, user: AuthUser) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { subTopics: { where: { archivedAt: null }, select: { id: true, name: true } } },
    })
    if (!topic) throw new NotFoundException('Topic not found')
    await this.coursesService.findOne(topic.courseId, user) // access check
    const types = dto.types?.length ? dto.types : [QuestionType.MCQ, QuestionType.TRUE_FALSE]

    // Ground in the passages of the student's material most relevant to this topic, if there are any
    const course = await this.prisma.course.findUniqueOrThrow({ where: { id: topic.courseId } })
    const query = [topic.name, topic.description, ...topic.subTopics.map(t => t.name)].filter(Boolean).join('. ')
    const passages = await this.retrieval.retrieve(topic.courseId, query, user, {
      k: 8,
      topicIds: [topic.id, ...topic.subTopics.map(t => t.id)],
    })
    const doc = passages[0] ? { id: passages[0].documentId } : null
    const sourceText = passages.length
      ? passages.map(p => p.text).join('\n\n')
      : `${describeCourse(course)}\nTopic: ${topic.name}${topic.description ? ` — ${topic.description}` : ''}${
          topic.subTopics.length ? `\nSubtopics: ${topic.subTopics.map(t => t.name).join('; ')}` : ''
        }`

    // Try AI generation first; fall back to a local question bank (objective questions only) if AI is
    // unavailable or fails, so this never hard-blocks a student.
    let raw: RawGeneratedQuestion[]
    let isAiGenerated = true
    try {
      raw = await this.ai.generateQuestions(sourceText, {
        count: dto.count,
        types,
        difficulty: dto.difficulty,
        topicHint: topic.name,
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        documentId: doc?.id ?? topic.id,
        groundedInMaterial: !!doc,
      })
      raw = raw.filter(q => types.includes(q.type as QuestionType) && q.questionText && q.correctAnswer)
      if (raw.length === 0) throw new Error('No usable questions returned')
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
            marks: defaultMarks(q.type as QuestionType, q.marks),
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
    const topic = await this.prisma.topic.findUniqueOrThrow({ where: { id: topicId } })
    const course = await this.coursesService.findOne(topic.courseId, user)

    const byId = new Map(questions.map(q => [q.id, q]))
    const answerFor = new Map(dto.answers.map(a => [a.questionId, a]))

    // Written answers are marked by AI in one batch; if that fails they're shown ungraded with the model answer
    const written = questions.filter(q => q.questionType === 'SHORT_ANSWER' || q.questionType === 'THEORY')
    let grades = new Map<string, WrittenAnswerGrade>()
    let gradingFailed = false
    if (written.length) {
      try {
        const graded = await this.ai.gradeWrittenAnswers(
          written.map(q => ({
            id: q.id,
            type: q.questionType as 'SHORT_ANSWER' | 'THEORY',
            question: q.questionText,
            modelAnswer: [q.correctAnswer, q.explanation && `Model answer: ${q.explanation}`].filter(Boolean).join('\n'),
            marks: defaultMarks(q.questionType as QuestionType, q.marks),
            studentAnswer: answerFor.get(q.id)?.textAnswer ?? '',
          })),
          `COURSE: ${describeCourse(course)}\nTOPIC: ${topic.name}`,
          { userId: user.id, organizationId: user.organizationId ?? undefined, relatedEntityId: topicId },
        )
        grades = new Map(graded.map(g => [g.id, g]))
      } catch (err) {
        gradingFailed = true
        this.logger.warn(`AI grading failed for topic ${topicId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    let earned = 0
    let possible = 0
    const results = dto.answers.map(a => {
      const q = byId.get(a.questionId)
      if (!q) return { questionId: a.questionId, isCorrect: null, score: null, maxScore: null, correctAnswer: null, explanation: null }

      const maxScore = defaultMarks(q.questionType as QuestionType, q.marks)
      if (q.questionType === 'MCQ' || q.questionType === 'TRUE_FALSE') {
        const isCorrect = a.selectedAnswer === q.correctAnswer
        earned += isCorrect ? 1 : 0
        possible += 1
        return { questionId: q.id, isCorrect, score: isCorrect ? 1 : 0, maxScore, correctAnswer: q.correctAnswer, explanation: q.explanation }
      }

      const grade = grades.get(q.id)
      if (grade) {
        earned += grade.score
        possible += maxScore
      }
      return {
        questionId: q.id,
        isCorrect: grade ? grade.score / maxScore >= 0.6 : null,
        score: grade?.score ?? null,
        maxScore,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        feedback: grade?.feedback ?? null,
        missingPoints: grade?.missingPoints ?? [],
      }
    })

    const scorePercent = possible > 0 ? Math.round((earned / possible) * 100) : null
    let planMessage: string | null = null
    let attemptId: string | null = null

    if (scorePercent !== null) {
      const existing = await this.prisma.topicMastery.findUnique({
        where: { studentId_topicId: { studentId: user.id, topicId } },
      })
      // Recent quizzes count more than older ones
      const newAverage =
        existing?.quizAverage != null ? Math.round(0.6 * scorePercent + 0.4 * existing.quizAverage) : scorePercent

      await this.prisma.topicMastery.upsert({
        where: { studentId_topicId: { studentId: user.id, topicId } },
        create: { studentId: user.id, topicId, quizAverage: newAverage, masteryScore: newAverage, revisionCount: 1, lastAssessedAt: new Date() },
        update: { quizAverage: newAverage, masteryScore: newAverage, revisionCount: { increment: 1 }, lastAssessedAt: new Date() },
      })

      const attempt = await this.prisma.selfQuizAttempt.create({
        data: {
          studentId: user.id,
          topicId,
          courseId: topic.courseId,
          difficulty: questions[0]!.difficulty,
          scorePercent,
          questionCount: questions.length,
          results: results as object[],
        },
      })
      attemptId = attempt.id
      planMessage = await this.adjustPlanAfterQuiz(topicId, topic.courseId, scorePercent, user).catch(err => {
        this.logger.warn(`Plan adjustment after quiz failed: ${String(err)}`)
        return null
      })
    }

    const difficulty = questions[0]!.difficulty
    return {
      attemptId,
      scorePercent,
      results,
      gradingFailed,
      mistakes: results.filter(r => r.isCorrect === false).length,
      isWeak: scorePercent !== null && scorePercent < WEAK_TOPIC_THRESHOLD,
      recommendedDifficulty: recommendDifficulty(difficulty, scorePercent),
      planMessage,
    }
  }

  async getQuizHistory(topicId: string, user: AuthUser) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) throw new NotFoundException('Topic not found')
    await this.coursesService.findOne(topic.courseId, user)
    const attempts = await this.prisma.selfQuizAttempt.findMany({
      where: { studentId: user.id, topicId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, difficulty: true, scorePercent: true, questionCount: true, createdAt: true },
    })
    const last = attempts[0]
    return {
      attempts,
      recommendedDifficulty: last ? recommendDifficulty(last.difficulty, last.scorePercent) : 'EASY',
    }
  }

  // Turns the questions a student got wrong into flashcards (spec §9: retention from weak areas)
  async flashcardsFromAttempt(attemptId: string, user: AuthUser) {
    const attempt = await this.prisma.selfQuizAttempt.findUnique({ where: { id: attemptId } })
    if (!attempt || attempt.studentId !== user.id) throw new NotFoundException('Quiz attempt not found')
    const wrong = (attempt.results as { questionId: string; isCorrect: boolean | null }[]).filter(r => r.isCorrect === false)
    if (wrong.length === 0) return { created: 0 }

    const questions = await this.prisma.question.findMany({ where: { id: { in: wrong.map(r => r.questionId) } } })
    const cards = questions.map(q => {
      const options = (q.options as { key: string; text: string }[] | null) ?? []
      const answer = options.find(o => o.key === q.correctAnswer)?.text ?? q.correctAnswer
      return {
        organizationId: user.organizationId ?? null,
        studentId: user.id,
        topicId: attempt.topicId,
        courseId: attempt.courseId,
        front: q.questionText,
        back: q.explanation && q.questionType !== 'THEORY' ? `${answer} — ${q.explanation}` : answer,
      }
    })
    await this.prisma.flashcard.createMany({ data: cards })
    return { created: cards.length }
  }

  // ─── Exam readiness ───────────────────────────────────────────────────────

  // 0-100 readiness: quiz mastery (55%), topic coverage (30%) and flashcard retention (15%, when the student
  // uses flashcards). Never-quizzed topics count as 0 mastery, so readiness only rises with real evidence.
  async getReadiness(courseId: string, user: AuthUser) {
    await this.coursesService.findOne(courseId, user)
    const topics = await this.prisma.topic.findMany({
      where: { courseId, parentTopicId: null, archivedAt: null },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    })
    const ids = topics.map(t => t.id)
    const [masteries, sessions, lessons, attempts, cards, plan] = await Promise.all([
      this.prisma.topicMastery.findMany({ where: { studentId: user.id, topicId: { in: ids } } }),
      this.prisma.studySession.findMany({
        where: { studentId: user.id, topicId: { in: ids }, status: 'COMPLETED' },
        select: { topicId: true },
      }),
      this.prisma.topicLesson.findMany({ where: { topicId: { in: ids } }, select: { topicId: true }, distinct: ['topicId'] }),
      this.prisma.selfQuizAttempt.findMany({ where: { studentId: user.id, topicId: { in: ids } }, select: { topicId: true }, distinct: ['topicId'] }),
      this.prisma.flashcard.findMany({ where: { studentId: user.id, courseId }, select: { dueDate: true, repetitions: true } }),
      this.prisma.studyPlan.findFirst({
        where: { studentId: user.id, courseId, status: 'ACTIVE' },
        select: { examDate: true, planType: true },
      }),
    ])

    const studied = new Set([...sessions.map(s => s.topicId), ...attempts.map(a => a.topicId)])
    const opened = new Set(lessons.map(l => l.topicId))
    const perTopic = topics.map(t => {
      const mastery = masteries.find(m => m.topicId === t.id)?.quizAverage ?? null
      const coverage = studied.has(t.id) ? 1 : opened.has(t.id) ? 0.5 : 0
      const status =
        mastery === null ? (coverage > 0 ? 'not-quizzed' : 'not-started') : mastery >= 80 ? 'strong' : mastery >= WEAK_TOPIC_THRESHOLD ? 'ok' : 'weak'
      return { topicId: t.id, name: t.name, mastery, coverage, status }
    })

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const masteryScore = avg(perTopic.map(t => t.mastery ?? 0))
    const coverageScore = avg(perTopic.map(t => t.coverage)) * 100
    const reviewed = cards.filter(c => c.repetitions > 0)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const retentionScore = reviewed.length ? (reviewed.filter(c => c.dueDate.getTime() >= dayAgo).length / reviewed.length) * 100 : null

    const score = Math.round(
      retentionScore === null
        ? (masteryScore * 0.55 + coverageScore * 0.3) / 0.85
        : masteryScore * 0.55 + coverageScore * 0.3 + retentionScore * 0.15,
    )
    const label = score >= 85 ? 'Exam ready' : score >= 70 ? 'On track' : score >= 40 ? 'Getting there' : 'Not ready yet'

    return {
      score: topics.length ? score : 0,
      label,
      mastery: Math.round(masteryScore),
      coverage: Math.round(coverageScore),
      retention: retentionScore === null ? null : Math.round(retentionScore),
      // Only a real exam date counts down; a fixed-length plan's end date isn't an exam
      daysToExam:
        plan?.planType === 'EXAM_DATE'
          ? Math.max(0, Math.ceil((plan.examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
          : null,
      topics: perTopic,
    }
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

    // Ground in the passages of the student's material most relevant to this topic, if there are any
    const course = await this.prisma.course.findUniqueOrThrow({ where: { id: topic.courseId } })
    const passages = await this.retrieval.retrieve(topic.courseId, `${topic.name}. ${topic.description ?? ''}`, user, {
      k: 8,
      topicIds: [topic.id],
    })
    const doc = passages[0] ? { id: passages[0].documentId } : null
    const sourceText = passages.length
      ? passages.map(p => p.text).join('\n\n')
      : `${describeCourse(course)}\nTopic: ${topic.name}${topic.description ? ` — ${topic.description}` : ''}`

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
      include: { topics: { where: { parentTopicId: null, archivedAt: null }, select: { id: true } } },
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

  // ─── Course suggestions from the academic profile ─────────────────────────

  async suggestCourses(dto: SuggestCoursesDto, user: AuthUser) {
    const profile = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    if (!profile.programme) {
      throw new BadRequestException('Add your programme in your profile first so we can suggest courses')
    }
    const level = dto.level ?? profile.currentLevel
    const semester = dto.semester ?? profile.currentSemester

    const existing = await this.prisma.course.findMany({
      where: { ownerId: user.id },
      select: { title: true, courseCode: true },
    })
    const existingTitles = existing.map(c => (c.courseCode ? `${c.courseCode} ${c.title}` : c.title))

    const studentContext = [
      `Programme: ${profile.programme}`,
      profile.faculty && `Faculty: ${profile.faculty}`,
      profile.institution && `Institution: ${profile.institution}`,
      profile.institutionType && `Institution type: ${profile.institutionType.replace(/_/g, ' ').toLowerCase()}`,
      profile.country && `Country: ${profile.country}`,
      level && `Level: ${level}`,
      semester && `Semester: ${SEMESTER_LABEL[semester]}`,
    ]
      .filter(Boolean)
      .join('\n')

    let raw: RawSuggestedCourse[]
    try {
      raw = await this.ai.suggestProgrammeCourses(studentContext, existingTitles, {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        relatedEntityId: user.id,
      })
    } catch (err) {
      this.logger.warn(`AI course suggestion failed for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`)
      throw new BadRequestException("Couldn't suggest courses right now — try again in a moment, or add your courses manually")
    }

    const taken = new Set(existing.map(c => c.title.toLowerCase()))
    const courses = raw
      .filter(c => c.title && !taken.has(c.title.toLowerCase()))
      .map(c => ({
        courseCode: c.courseCode?.trim() || undefined,
        title: c.title.trim(),
        creditUnits: Number.isInteger(c.creditUnits) ? c.creditUnits : undefined,
        level,
        semester,
      }))
    // Level 3 of the curriculum hierarchy: AI suggestions, never presented as an official list
    return { source: 'ai' as const, courses }
  }

  // ─── Course outline: input (paste / document / photo) and AI expansion ────

  // Proposals are returned for review, never saved directly; the original outline text is preserved on the course
  private async proposeFromOutlineText(text: string, courseId: string, user: AuthUser) {
    try {
      const proposals = await this.ai.extractTopics(text, {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        documentId: courseId,
      })
      return { source: 'ai' as const, proposals }
    } catch (err) {
      this.logger.warn(`AI outline extraction failed for course ${courseId}: ${err instanceof Error ? err.message : String(err)}`)
      return { source: 'fallback' as const, proposals: extractTopicsHeuristically(text) }
    }
  }

  async outlineFromText(courseId: string, text: string, user: AuthUser) {
    await this.topicsService.assertCanEdit(courseId, user)
    await this.prisma.course.update({ where: { id: courseId }, data: { outlineText: text, outlineSource: 'PASTE' } })
    return this.proposeFromOutlineText(text, courseId, user)
  }

  async outlineFromDocument(courseId: string, documentId: string, user: AuthUser) {
    await this.topicsService.assertCanEdit(courseId, user)
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, courseId } })
    if (!doc) throw new NotFoundException('Document not found in this course')
    if (doc.status !== 'READY' || !doc.extractedText?.trim()) {
      throw new BadRequestException("We couldn't read any text from that file — try another file, paste the outline, or take a photo")
    }
    await this.prisma.course.update({
      where: { id: courseId },
      data: { outlineText: doc.extractedText, outlineSource: 'UPLOAD' },
    })
    return this.proposeFromOutlineText(doc.extractedText, courseId, user)
  }

  async outlineFromPhoto(courseId: string, file: { buffer: Buffer; mimetype: string }, user: AuthUser) {
    await this.topicsService.assertCanEdit(courseId, user)
    let result: Awaited<ReturnType<AiService['extractOutlineFromImage']>>
    try {
      result = await this.ai.extractOutlineFromImage(file.buffer, file.mimetype, {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        relatedEntityId: courseId,
      })
    } catch (err) {
      this.logger.warn(`AI photo outline failed for course ${courseId}: ${err instanceof Error ? err.message : String(err)}`)
      throw new BadRequestException("Couldn't read that photo right now — try again in a moment")
    }
    if (result.topics.length === 0) {
      throw new BadRequestException("We couldn't find a course outline in that photo — try a clearer, well-lit shot of the page")
    }
    await this.prisma.course.update({
      where: { id: courseId },
      data: { outlineText: result.transcription || null, outlineSource: 'PHOTO' },
    })
    return { source: 'ai' as const, proposals: result.topics }
  }

  // Adds AI subtopics (the Nightklass learning layer) under one topic, or under every top-level topic without any
  async expandOutline(courseId: string, topicId: string | undefined, user: AuthUser) {
    const course = await this.topicsService.assertCanEdit(courseId, user)

    const topLevel = await this.prisma.topic.findMany({
      where: { courseId, parentTopicId: null, archivedAt: null, ...(topicId && { id: topicId }) },
      orderBy: { order: 'asc' },
      include: { subTopics: { where: { archivedAt: null }, select: { id: true, order: true } } },
    })
    const targets = topicId ? topLevel : topLevel.filter(t => t.subTopics.length === 0)
    if (targets.length === 0) {
      throw new BadRequestException(
        topicId ? 'Topic not found' : 'Every topic already has subtopics — expand a single topic to add more',
      )
    }

    const doc = await this.prisma.document.findFirst({
      where: { courseId, status: 'READY', extractedText: { not: null } },
      orderBy: { createdAt: 'desc' },
    })

    let expanded: Awaited<ReturnType<AiService['expandOutline']>>
    try {
      expanded = await this.ai.expandOutline(describeCourse(course), targets, doc?.extractedText ?? null, {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        relatedEntityId: courseId,
      })
    } catch (err) {
      this.logger.warn(`AI outline expansion failed for course ${courseId}: ${err instanceof Error ? err.message : String(err)}`)
      throw new BadRequestException("Couldn't expand the outline right now — try again in a moment")
    }

    const byName = new Map(expanded.map(e => [e.topic?.trim().toLowerCase(), e.subtopics ?? []]))
    let created = 0
    await this.prisma.$transaction(async tx => {
      for (const [i, target] of targets.entries()) {
        // Match by name, falling back to position if the model reworded a topic
        const subs = byName.get(target.name.trim().toLowerCase()) ?? expanded[i]?.subtopics ?? []
        let order = Math.max(-1, ...target.subTopics.map(s => s.order)) + 1
        for (const sub of subs.filter(s => s?.name)) {
          await tx.topic.create({
            data: {
              courseId,
              parentTopicId: target.id,
              name: sub.name.slice(0, 200),
              description: sub.description,
              source: TopicSource.AI_EXPANDED,
              order: order++,
            },
          })
          created += 1
        }
      }
    })

    await this.topicsService.recordRevision(courseId, user.id, `Expanded ${targets.length} topic(s) with AI`)
    return { expandedTopics: targets.length, createdSubtopics: created }
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

  // ─── AI study chat ────────────────────────────────────────────────────────

  async chat(courseId: string, dto: ChatDto, user: AuthUser) {
    const course = await this.coursesService.findOne(courseId, user) // access check

    // Retrieve the passages most relevant to this question (plus the previous question, for follow-ups)
    const previousQuestion = [...(dto.history ?? [])].reverse().find(m => m.role === 'user')?.content ?? ''
    const passages = await this.retrieval.retrieve(courseId, `${dto.message}\n${previousQuestion}`.trim(), user, { k: 6 })
    const combinedText = passages.map((p, i) => `[Passage ${i + 1} — ${p.documentName}]\n${p.text}`).join('\n\n')
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
