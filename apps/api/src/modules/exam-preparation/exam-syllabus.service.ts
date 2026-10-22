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
import { ExamSyllabusDto, ObjectiveStudyDto, SyllabusStateDto } from './exam-syllabus.dto'
import { subjectIdentity } from './exam-content.rules'
@Injectable()
export class ExamSyllabusService {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.examSyllabus.findMany({
      include: {
        objectives: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
      },
      orderBy: [{ year: 'desc' }, { subject: 'asc' }, { version: 'desc' }],
      take: 100,
    })
  }
  private async mutate<T>(
    actorId: string,
    action: string,
    fn: (tx: Prisma.TransactionClient) => Promise<{ id: string; result: T }>,
  ) {
    try {
      return await serializable(this.prisma, 
        async (tx) => {
          const grant = await tx.nightklassAdmin.findUnique({
            where: { userId: actorId },
            include: { user: { select: { status: true, organizationId: true } } },
          })
          if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId)
            throw new ForbiddenException('Administrator access required')
          const { id, result } = await fn(tx)
          await tx.nightklassAdminAudit.create({
            data: { actorId, action, resourceType: 'exam-syllabus', resourceId: id },
          })
          return result
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (err) {
      if (['P2002', 'P2034', 'P2003'].includes((err as { code: string })?.code))
        throw new ConflictException(
          'Duplicate, linked objective or concurrent change. Refresh before saving.',
        )
      throw err
    }
  }
  save(dto: ExamSyllabusDto, actorId: string) {
    if (new Set(dto.objectives.map((o) => o.code.trim())).size !== dto.objectives.length)
      throw new BadRequestException('Objective codes must be unique')
    if (dto.objectives.some((o) => !o.code.trim() || !o.title.trim() || !o.description.trim()))
      throw new BadRequestException('Objective fields cannot be blank')
    if (dto.provenance === 'OFFICIAL' && !dto.sourceUrl)
      throw new BadRequestException('Official syllabuses require a verifiable source URL')
    return this.mutate(actorId, 'exam.syllabus.save', async (tx) => {
      const { id, objectives, expectedRevision, ...fields } = dto
      const data = { ...fields, subjectKey: subjectIdentity(dto.subject) }
      let syllabus
      if (!id && expectedRevision === 0)
        syllabus = await tx.examSyllabus.create({
          data: {
            ...data,
            objectives: {
              create: objectives.map((o, order) => ({ ...o, code: o.code.trim(), order })),
            },
          },
        })
      else {
        if (!id) throw new BadRequestException('Select a syllabus draft')
        const original = await tx.examSyllabus.findUnique({ where: { id } })
        if (
          original &&
          (original.exam !== dto.exam ||
            original.year !== dto.year ||
            original.subjectKey !== subjectIdentity(dto.subject) ||
            original.version !== dto.version)
        )
          throw new BadRequestException(
            'Create a new syllabus version to change its exam, year, subject or version number',
          )
        const updated = await tx.examSyllabus.updateMany({
          where: { id, status: 'DRAFT', revision: expectedRevision },
          data: { ...data, revision: { increment: 1 } },
        })
        if (!updated.count)
          throw new ConflictException(
            'Only the current draft can be edited. Create a new version to change a published syllabus.',
          )
        await tx.examSyllabusObjective.deleteMany({
          where: { syllabusId: id, code: { notIn: objectives.map((o) => o.code.trim()) } },
        })
        for (const [order, o] of objectives.entries())
          await tx.examSyllabusObjective.upsert({
            where: { syllabusId_code: { syllabusId: id, code: o.code.trim() } },
            create: { ...o, code: o.code.trim(), order, syllabusId: id },
            update: { title: o.title, description: o.description, order },
          })
        syllabus = await tx.examSyllabus.findUniqueOrThrow({ where: { id } })
      }
      return {
        id: syllabus.id,
        result: await tx.examSyllabus.findUniqueOrThrow({
          where: { id: syllabus.id },
          include: { objectives: { orderBy: { order: 'asc' } } },
        }),
      }
    })
  }
  state(id: string, dto: SyllabusStateDto, actorId: string) {
    return this.mutate(actorId, 'exam.syllabus.' + dto.status.toLowerCase(), async (tx) => {
      const syllabus = await tx.examSyllabus.findUnique({
        where: { id },
        include: { objectives: true },
      })
      if (!syllabus) throw new NotFoundException('Syllabus not found')
      if (syllabus.revision !== dto.expectedRevision)
        throw new ConflictException('Syllabus changed. Refresh before publishing.')
      if (dto.status === 'APPROVED') {
        if (syllabus.status !== 'DRAFT' || !syllabus.objectives.length)
          throw new BadRequestException('Publish a nonempty draft')
        if (syllabus.provenance === 'OFFICIAL' && !syllabus.sourceUrl)
          throw new BadRequestException('Official source URL required')
        await tx.examSyllabus.updateMany({
          where: {
            exam: syllabus.exam,
            year: syllabus.year,
            subjectKey: syllabus.subjectKey,
            status: 'APPROVED',
          },
          data: { status: 'ARCHIVED', revision: { increment: 1 } },
        })
      }
      const result = await tx.examSyllabus.update({
        where: { id },
        data: { status: dto.status, reviewedById: actorId, revision: { increment: 1 } },
      })
      return { id, result }
    })
  }
  private async subject(goalId: string, key: string, user: AuthUser) {
    if (user.organizationId || user.role !== UserRole.STUDENT)
      throw new ForbiddenException('Standalone learner access required')
    const subject = await this.prisma.examGoalSubject.findFirst({
      where: {
        goalId,
        subjectKey: key,
        goal: { studentId: user.id },
        course: { ownerId: user.id },
      },
      include: { goal: true },
    })
    if (!subject) throw new NotFoundException('Exam subject not found')
    return subject
  }
  async coverage(goalId: string, key: string, user: AuthUser) {
    const subject = await this.subject(goalId, key, user)
    const syllabus = await this.prisma.examSyllabus.findFirst({
      where: {
        exam: subject.goal.exam,
        year: subject.goal.year,
        subjectKey: key,
        status: 'APPROVED',
      },
      include: {
        objectives: {
          orderBy: { order: 'asc' },
          include: {
            questions: { include: { question: { select: { id: true, status: true } } } },
            studyLinks: { where: { studentId: user.id }, select: { topicId: true } },
          },
        },
      },
      orderBy: { version: 'desc' },
    })
    if (!syllabus)
      return {
        syllabus: null,
        objectives: [],
        summary: { total: 0, withReviewedPractice: 0, studied: 0, assessed: 0 },
        note: 'No reviewed syllabus is published for this exam year and subject yet. You can still study from your own outline and materials.',
      }
    const bankIds = syllabus.objectives.flatMap((o) => o.questions.map((link) => link.questionId))
    const [copies, quizzes, mocks, masteries] = await Promise.all([
      this.prisma.question.findMany({
        where: { createdById: user.id, sourceExamBankQuestionId: { in: bankIds } },
        select: { id: true, sourceExamBankQuestionId: true },
      }),
      this.prisma.selfQuizAttempt.findMany({
        where: { studentId: user.id, courseId: subject.courseId },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { results: true },
      }),
      this.prisma.examMockAttempt.findMany({
        where: { studentId: user.id, goalId, status: { in: ['GRADED', 'SUBMITTED'] } },
        orderBy: { startedAt: 'desc' },
        take: 100,
        select: { questions: true, result: true, answers: true },
      }),
      this.prisma.studySession.findMany({
        where: {
          studentId: user.id,
          status: 'COMPLETED',
          topicId: { in: syllabus.objectives.flatMap((o) => o.studyLinks.map((l) => l.topicId)) },
        },
        select: { topicId: true },
      }),
    ])
    const scores = new Map<string, { earned: number; possible: number }>()
    const add = (id: string, earned: number, possible: number) => {
      if (!Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0) return
      const previous = scores.get(id) ?? { earned: 0, possible: 0 }
      scores.set(id, { earned: previous.earned + earned, possible: previous.possible + possible })
    }
    const copyMap = new Map(copies.map((q) => [q.id, q.sourceExamBankQuestionId!]))
    for (const attempt of quizzes)
      for (const r of attempt.results as {
        questionId: string
        score: number | null
        maxScore: number
      }[]) {
        const id = copyMap.get(r.questionId)
        if (id && r.score !== null) add(id, r.score, r.maxScore)
      }
    for (const attempt of mocks) {
      const result = attempt.result as {
        exam?: string
        results?: { questionId: string; score: number | null; maxScore: number }[]
      } | null
      if (result?.exam === 'WAEC') {
        for (const r of result.results ?? [])
          if (r.score !== null) add(r.questionId, r.score, r.maxScore)
      } else {
        for (const q of attempt.questions as { id: string; correctAnswer: string }[])
          add(
            q.id,
            (attempt.answers as Record<string, string>)[q.id] === q.correctAnswer ? 1 : 0,
            1,
          )
      }
    }
    const completed = new Set(masteries.map((s) => s.topicId))
    const objectives = syllabus.objectives.map((o) => {
      const evidence = o.questions
        .map((l) => scores.get(l.questionId))
        .filter((x): x is { earned: number; possible: number } => !!x)
      const possible = evidence.reduce((sum, e) => sum + e.possible, 0)
      return {
        id: o.id,
        code: o.code,
        title: o.title,
        description: o.description,
        reviewedQuestions: o.questions.filter((l) => l.question.status === 'APPROVED').length,
        topicId: o.studyLinks[0]?.topicId ?? null,
        studied: o.studyLinks.some((l) => completed.has(l.topicId)),
        practiceAccuracy: possible
          ? Math.round((evidence.reduce((sum, e) => sum + e.earned, 0) / possible) * 100)
          : null,
      }
    })
    return {
      syllabus: {
        id: syllabus.id,
        title: syllabus.title,
        version: syllabus.version,
        provenance: syllabus.provenance,
        sourceUrl: syllabus.sourceUrl,
        sourceNote: syllabus.sourceNote,
      },
      objectives,
      summary: {
        total: objectives.length,
        withReviewedPractice: objectives.filter((o) => o.reviewedQuestions > 0).length,
        studied: objectives.filter((o) => o.studied).length,
        assessed: objectives.filter((o) => o.practiceAccuracy !== null).length,
      },
      note: 'Practice accuracy reflects recent recorded practice, not a prediction of your official exam result.',
    }
  }
  async study(dto: ObjectiveStudyDto, user: AuthUser) {
    const objective = await this.prisma.examSyllabusObjective.findUnique({
      where: { id: dto.objectiveId },
      include: { syllabus: true },
    })
    if (!objective || objective.syllabus.status !== 'APPROVED')
      throw new NotFoundException('Published objective not found')
    const subject = await this.subject(dto.goalId, objective.syllabus.subjectKey, user)
    if (
      subject.goal.exam !== objective.syllabus.exam ||
      subject.goal.year !== objective.syllabus.year
    )
      throw new BadRequestException('Objective does not match this exam goal')
    try {
      return await serializable(this.prisma, 
        async (tx) => {
          const existing = await tx.examObjectiveStudyLink.findUnique({
            where: { studentId_objectiveId: { studentId: user.id, objectiveId: objective.id } },
          })
          if (existing) return existing
          let topic = await tx.topic.findFirst({
            where: { courseId: subject.courseId, name: objective.title, archivedAt: null },
          })
          if (!topic)
            topic = await tx.topic.create({
              data: {
                courseId: subject.courseId,
                name: objective.title,
                description: objective.description,
                source: 'OUTLINE',
                order: objective.order,
              },
            })
          return tx.examObjectiveStudyLink.create({
            data: { studentId: user.id, objectiveId: objective.id, topicId: topic.id },
          })
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (err) {
      if (['P2002', 'P2034'].includes((err as { code: string })?.code))
        throw new ConflictException('Study setup changed. Please try again.')
      throw err
    }
  }
}
