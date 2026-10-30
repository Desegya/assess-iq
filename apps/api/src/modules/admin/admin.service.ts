import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@assessiq/db'
import { AuthUser, UserRole } from '@assessiq/types'
import { LessonVisualsService } from '../learning/lesson-visuals.service'
import { PrismaService } from '../prisma/prisma.service'
import { CoursesService } from '../courses/courses.service'
import { TopicsService } from '../topics/topics.service'
import { CreateCourseDto } from '../courses/dto/create-course.dto'
import { UpdateCourseDto } from '../courses/dto/update-course.dto'
import { CreateTopicDto } from '../topics/dto/create-topic.dto'
import { UpdateTopicDto } from '../topics/dto/update-topic.dto'
import {
  AdminAccessDto,
  AdminLessonDto,
  AdminQueryDto,
  AdminQuestionDto,
  AdminReportDto,
  AdminStatusDto,
} from './admin.dto'

export const NIGHTKLASS_USER = { organizationId: null, role: 'STUDENT' as const }
export const NIGHTKLASS_COURSE = { organizationId: null, owner: { is: NIGHTKLASS_USER } }
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  programme: true,
  currentLevel: true,
  institution: true,
  nightklassAdmin: { select: { role: true } },
} as const
const COURSE_SUMMARY = {
  id: true,
  title: true,
  courseCode: true,
  isActive: true,
  owner: { select: { id: true, name: true } },
} as const

export function validateQuestion(dto: AdminQuestionDto) {
  if (!dto.questionText.trim() || !dto.correctAnswer.trim())
    throw new BadRequestException('Question and answer cannot be blank')
  if (dto.questionType === 'MCQ') {
    const options = dto.options ?? []
    if (
      options.length < 2 ||
      new Set(options.map((o) => o.key)).size !== options.length ||
      options.some((o) => !o.text.trim()) ||
      !options.some((o) => o.key === dto.correctAnswer)
    ) {
      throw new BadRequestException(
        'Provide at least two unique options and select a matching answer key',
      )
    }
  } else if (
    dto.questionType === 'TRUE_FALSE' &&
    !['true', 'false'].includes(dto.correctAnswer.toLowerCase())
  ) {
    throw new BadRequestException('The answer must be true or false')
  }
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly visuals: LessonVisualsService) {}

  private page(q: AdminQueryDto) {
    return { skip: (q.page - 1) * q.limit, take: q.limit }
  }
  private result<T>(items: T[], total: number, q: AdminQueryDto) {
    return { items, total, page: q.page, limit: q.limit }
  }
  private text(search?: string) {
    return search?.trim() ? { contains: search.trim(), mode: 'insensitive' as const } : undefined
  }
  private assertStatus(q: AdminQueryDto, allowed: string[]) {
    if (q.status && !allowed.includes(q.status))
      throw new BadRequestException('Invalid status filter')
  }
  private audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    return tx.nightklassAdminAudit.create({
      data: { actorId, action, resourceType, resourceId, metadata },
    })
  }
  private async course(tx: Prisma.TransactionClient, id: string) {
    const course = await tx.course.findFirst({
      where: { id, ...NIGHTKLASS_COURSE },
      include: { owner: { select: { id: true, name: true, email: true } } },
    })
    if (!course?.owner) throw new NotFoundException('Nightklass course not found')
    return course
  }
  private owner(course: { owner: { id: string; email: string } | null }): AuthUser {
    return {
      id: course.owner!.id,
      email: course.owner!.email,
      role: UserRole.STUDENT,
      organizationId: null,
    }
  }
  private async transaction<T>(actorId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const grant = await tx.nightklassAdmin.findUnique({
            where: { userId: actorId },
            include: { user: { select: { status: true, organizationId: true } } },
          })
          if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId !== null)
            throw new ForbiddenException('Nightklass administrator access required')
          return fn(tx)
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      )
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      )
        throw new ConflictException('This record changed. Refresh and try again.')
      throw error
    }
  }

  async me(actorId: string) {
    return this.prisma.nightklassAdmin.findUniqueOrThrow({
      where: { userId: actorId },
      select: { role: true, user: { select: { id: true, name: true, email: true } } },
    })
  }

  async overview() {
    const since = new Date(Date.now() - 30 * 86400000)
    const [
      users,
      newUsers,
      activeLearners,
      courses,
      lessons,
      questions,
      openReports,
      completedSessions,
      quiz,
      ai,
      recent,
    ] = await Promise.all([
      this.prisma.user.count({ where: NIGHTKLASS_USER }),
      this.prisma.user.count({ where: { ...NIGHTKLASS_USER, createdAt: { gte: since } } }),
      this.prisma.user.count({
        where: {
          ...NIGHTKLASS_USER,
          OR: [
            { studySessions: { some: { completedAt: { gte: since }, status: 'COMPLETED' } } },
            { topicMasteries: { some: { lastAssessedAt: { gte: since } } } },
            { flashcards: { some: { lastReviewedAt: { gte: since } } } },
          ],
        },
      }),
      this.prisma.course.count({ where: NIGHTKLASS_COURSE }),
      this.prisma.topicLesson.count({ where: { topic: { course: NIGHTKLASS_COURSE } } }),
      this.prisma.question.count({ where: { organizationId: null, course: NIGHTKLASS_COURSE } }),
      this.prisma.contentReport.count({
        where: { status: 'OPEN', lesson: { topic: { course: NIGHTKLASS_COURSE } } },
      }),
      this.prisma.studySession.count({
        where: { student: NIGHTKLASS_USER, status: 'COMPLETED', completedAt: { gte: since } },
      }),
      this.quizStats(since),
      this.prisma.aIUsageLog.aggregate({
        where: { user: NIGHTKLASS_USER, organizationId: null, createdAt: { gte: since } },
        _count: true,
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      }),
      this.prisma.nightklassAdminAudit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { actor: { select: { name: true } } },
      }),
    ])
    return {
      since,
      asOf: new Date(),
      users,
      newUsers,
      activeLearners,
      courses,
      lessons,
      questions,
      openReports,
      completedSessions,
      quizAttempts: quiz.count,
      averageQuizScore: quiz.average,
      aiRequests: ai._count,
      aiCostUsd: ai._sum.costUsd ?? 0,
      recent,
    }
  }

  // SelfQuizAttempt has no Prisma relation; scope its aggregates through joins in SQL.
  private async quizStats(since: Date) {
    const rows = await this.prisma.$queryRaw<{ count: number; average: number | null }[]>`
      SELECT COUNT(*)::int AS count, AVG(a."scorePercent")::float AS average
      FROM self_quiz_attempts a JOIN courses c ON c.id = a."courseId"
      JOIN users u ON u.id = c."ownerId"
      WHERE c."organizationId" IS NULL AND u."organizationId" IS NULL
      AND u.role = 'STUDENT' AND a."createdAt" >= ${since}`
    return rows[0]!
  }

  async activity(q: AdminQueryDto) {
    this.assertStatus(q, ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'RESCHEDULED'])
    const where: Prisma.StudySessionWhereInput = {
      student: NIGHTKLASS_USER,
      course: NIGHTKLASS_COURSE,
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search ? { student: { ...NIGHTKLASS_USER, name: this.text(q.search) } } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.studySession.findMany({
        where,
        ...this.page(q),
        orderBy: [{ scheduledDate: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          completedAt: true,
          estimatedMinutes: true,
          actualMinutes: true,
          student: { select: { name: true } },
          course: { select: { title: true } },
          topic: { select: { name: true } },
        },
      }),
      this.prisma.studySession.count({ where }),
    ])
    return this.result(items, total, q)
  }

  async users(q: AdminQueryDto) {
    this.assertStatus(q, ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING'])
    const where: Prisma.UserWhereInput = {
      ...NIGHTKLASS_USER,
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search ? { OR: [{ name: this.text(q.search) }, { email: this.text(q.search) }] } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        ...this.page(q),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ])
    return this.result(items, total, q)
  }
  async user(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...NIGHTKLASS_USER },
      select: {
        ...USER_SELECT,
        _count: {
          select: { ownedCourses: true, studyPlans: true, studySessions: true, flashcards: true },
        },
      },
    })
    if (!user) throw new NotFoundException('Nightklass user not found')
    const [courses, sessions] = await Promise.all([
      this.prisma.course.findMany({
        where: { ownerId: id, ...NIGHTKLASS_COURSE },
        select: COURSE_SUMMARY,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studySession.findMany({
        where: { studentId: id },
        select: {
          id: true,
          status: true,
          completedAt: true,
          scheduledDate: true,
          course: { select: { title: true } },
        },
        take: 10,
        orderBy: { scheduledDate: 'desc' },
      }),
    ])
    return { ...user, courses, sessions }
  }
  async status(id: string, dto: AdminStatusDto, actorId: string) {
    return this.transaction(actorId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id, ...NIGHTKLASS_USER },
        select: { status: true, nightklassAdmin: true },
      })
      if (!user) throw new NotFoundException('Nightklass user not found')
      if (user.nightklassAdmin || id === actorId)
        throw new ConflictException(
          'Revoke administrative access before changing this account status',
        )
      await tx.user.update({ where: { id }, data: { status: dto.status }, select: { id: true } })
      await tx.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      })
      await this.audit(tx, actorId, 'USER_STATUS_CHANGED', 'user', id, {
        from: user.status,
        to: dto.status,
        reason: dto.reason,
      })
      return { id, status: dto.status }
    })
  }
  async access(id: string, dto: AdminAccessDto, actorId: string) {
    return this.transaction(actorId, async (tx) => {
      const actor = await tx.nightklassAdmin.findUnique({ where: { userId: actorId } })
      if (actor?.role !== 'OWNER')
        throw new ForbiddenException('Only a Nightklass owner can manage admin access')
      if (id === actorId) throw new ConflictException('You cannot change your own admin access')
      const user = await tx.user.findFirst({
        where: { id, ...NIGHTKLASS_USER, status: 'ACTIVE' },
        select: { id: true },
      })
      if (!user) throw new NotFoundException('Active Nightklass user not found')
      if (dto.role === 'NONE') await tx.nightklassAdmin.deleteMany({ where: { userId: id } })
      else
        await tx.nightklassAdmin.upsert({
          where: { userId: id },
          create: { userId: id, role: dto.role },
          update: { role: dto.role },
        })
      await tx.refreshToken.updateMany({ where: { userId: id }, data: { isRevoked: true } })
      await this.audit(tx, actorId, 'ADMIN_ACCESS_CHANGED', 'user', id, {
        role: dto.role,
        reason: dto.reason,
      })
      return { id, role: dto.role }
    })
  }
  async admins() {
    return this.prisma.nightklassAdmin.findMany({
      take: 100,
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    })
  }

  async courses(q: AdminQueryDto) {
    this.assertStatus(q, ['ACTIVE', 'ARCHIVED'])
    const where: Prisma.CourseWhereInput = {
      ...NIGHTKLASS_COURSE,
      ...(q.status ? { isActive: q.status === 'ACTIVE' } : {}),
      ...(q.search
        ? { OR: [{ title: this.text(q.search) }, { courseCode: this.text(q.search) }] }
        : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        ...this.page(q),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          ...COURSE_SUMMARY,
          subject: true,
          createdAt: true,
          _count: { select: { topics: true, questions: true, documents: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ])
    return this.result(items, total, q)
  }
  async courseDetail(id: string, q: AdminQueryDto) {
    const course = await this.course(this.prisma, id)
    const [topics, total] = await Promise.all([
      this.prisma.topic.findMany({
        where: { courseId: id },
        ...this.page(q),
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { lessons: true, questions: true } } },
      }),
      this.prisma.topic.count({ where: { courseId: id } }),
    ])
    return { ...course, topics: this.result(topics, total, q) }
  }
  async createCourse(ownerId: string, dto: CreateCourseDto, actorId: string) {
    if (dto.title.trim().length < 2) throw new BadRequestException('Provide a course title')
    return this.transaction(actorId, async (tx) => {
      const owner = await tx.user.findFirst({
        where: { id: ownerId, ...NIGHTKLASS_USER, status: 'ACTIVE' },
        select: { id: true, email: true },
      })
      if (!owner) throw new NotFoundException('Active Nightklass learner not found')
      const course = await new CoursesService(tx as PrismaService).create(
        dto,
        this.owner({ owner }),
      )
      await this.audit(tx, actorId, 'COURSE_CREATED', 'course', course.id, { ownerId })
      return course
    })
  }
  async updateCourse(id: string, dto: UpdateCourseDto, actorId: string) {
    if (dto.title !== undefined && (!dto.title || dto.title.trim().length < 2))
      throw new BadRequestException('Provide a course title')
    if (dto.subject !== undefined && (!dto.subject || dto.subject.trim().length < 2))
      throw new BadRequestException('Provide a course subject')
    return this.transaction(actorId, async (tx) => {
      const course = await this.course(tx, id)
      const result = await new CoursesService(tx as PrismaService).update(
        id,
        dto,
        this.owner(course),
      )
      await this.audit(tx, actorId, 'COURSE_UPDATED', 'course', id, { fields: Object.keys(dto) })
      return result
    })
  }
  async createTopic(courseId: string, dto: CreateTopicDto, actorId: string) {
    if (!dto.name.trim()) throw new BadRequestException('Provide a topic name')
    return this.transaction(actorId, async (tx) => {
      const course = await this.course(tx, courseId)
      const topic = await new TopicsService(
        tx as PrismaService,
        new CoursesService(tx as PrismaService),
      ).create(courseId, dto, this.owner(course))
      await this.audit(tx, actorId, 'TOPIC_CREATED', 'topic', topic.id)
      return topic
    })
  }
  async updateTopic(id: string, dto: UpdateTopicDto, actorId: string) {
    if (dto.name !== undefined && (!dto.name || !dto.name.trim()))
      throw new BadRequestException('Provide a topic name')
    return this.transaction(actorId, async (tx) => {
      const topic = await tx.topic.findFirst({ where: { id, course: NIGHTKLASS_COURSE } })
      if (!topic) throw new NotFoundException('Nightklass topic not found')
      const course = await this.course(tx, topic.courseId)
      const result = await new TopicsService(
        tx as PrismaService,
        new CoursesService(tx as PrismaService),
      ).update(id, dto, this.owner(course))
      await this.audit(tx, actorId, 'TOPIC_UPDATED', 'topic', id, { fields: Object.keys(dto) })
      return result
    })
  }
  async topicState(id: string, archive: boolean, reason: string, actorId: string) {
    return this.transaction(actorId, async (tx) => {
      const topic = await tx.topic.findFirst({ where: { id, course: NIGHTKLASS_COURSE } })
      if (!topic) throw new NotFoundException('Nightklass topic not found')
      if (!archive && topic.parentTopicId) {
        const parent = await tx.topic.findUnique({ where: { id: topic.parentTopicId } })
        if (parent?.archivedAt) throw new ConflictException('Restore the parent topic first')
      }
      // Descendant traversal stays in SQL; all history is preserved.
      await tx.$executeRaw`WITH RECURSIVE descendants AS (SELECT id FROM topics WHERE id = ${id} AND "courseId" = ${topic.courseId} UNION ALL SELECT t.id FROM topics t JOIN descendants d ON t."parentTopicId" = d.id WHERE t."courseId" = ${topic.courseId}) UPDATE topics SET "archivedAt" = ${archive ? new Date() : null} WHERE id IN (SELECT id FROM descendants)`
      const course = await this.course(tx, topic.courseId)
      await new TopicsService(
        tx as PrismaService,
        new CoursesService(tx as PrismaService),
      ).recordRevision(
        course.id,
        actorId,
        `Admin ${archive ? 'archived' : 'restored'} topic: ${reason}`,
      )
      await this.audit(tx, actorId, archive ? 'TOPIC_ARCHIVED' : 'TOPIC_RESTORED', 'topic', id, {
        reason,
      })
      return { id, archived: archive }
    })
  }

  async lessons(q: AdminQueryDto) {
    const where: Prisma.TopicLessonWhereInput = {
      topic: {
        course: NIGHTKLASS_COURSE,
        ...(q.courseId ? { courseId: q.courseId } : {}),
        ...(q.search ? { name: this.text(q.search) } : {}),
      },
    }
    const [items, total] = await Promise.all([
      this.prisma.topicLesson.findMany({
        where,
        ...this.page(q),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          version: true,
          mode: true,
          createdAt: true,
          topic: { select: { name: true, course: { select: COURSE_SUMMARY } } },
          _count: { select: { reports: true } },
        },
      }),
      this.prisma.topicLesson.count({ where }),
    ])
    return this.result(items, total, q)
  }
  async lesson(id: string) {
    const lesson = await this.prisma.topicLesson.findFirst({
      where: { id, topic: { course: NIGHTKLASS_COURSE } },
      include: { topic: { select: { id: true, name: true, courseId: true } } },
    })
    if (!lesson) throw new NotFoundException('Nightklass lesson not found')
    return { ...lesson, content: await this.visuals.forRead(lesson.content as Record<string, unknown>) }
  }
  async updateLesson(id: string, dto: AdminLessonDto, actorId: string) {
    if (
      !dto.sections.length ||
      !dto.introduction.trim() ||
      dto.sections.some((s) => !s.heading.trim() || !s.body.trim())
    )
      throw new BadRequestException('A lesson needs an introduction and non-empty sections')
    return this.transaction(actorId, async (tx) => {
      const lesson = await tx.topicLesson.findFirst({
        where: { id, topic: { course: NIGHTKLASS_COURSE } },
      })
      if (!lesson) throw new NotFoundException('Nightklass lesson not found')
      const latest = await tx.topicLesson.findFirst({
        where: { topicId: lesson.topicId },
        orderBy: { version: 'desc' },
      })
      if (latest?.version !== dto.expectedVersion || latest.id !== id)
        throw new ConflictException('Edit the latest lesson version. Refresh this page.')
      const content = lesson.content as Prisma.JsonObject
      const result = await tx.topicLesson.create({
        data: {
          topicId: lesson.topicId,
          version: lesson.version + 1,
          mode: lesson.mode,
          content: {
            ...content,
            introduction: dto.introduction,
            sections: dto.sections.map((s) => ({ heading: s.heading, body: s.body })),
            summary: dto.summary,
            // A correction can change the concept or section order. Earlier versions retain their media.
            visuals: [],
            visualPlans: [],
          } as Prisma.InputJsonObject,
          sourceChunkIds: lesson.sourceChunkIds,
          sourceDocumentIds: lesson.sourceDocumentIds,
          createdById: actorId,
          feedback: dto.reason,
          model: lesson.model,
        },
      })
      await this.audit(tx, actorId, 'LESSON_CORRECTED', 'lesson', result.id, {
        previousId: id,
        reason: dto.reason,
      })
      return result
    })
  }
  async questions(q: AdminQueryDto) {
    this.assertStatus(q, ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'])
    const where: Prisma.QuestionWhereInput = {
      organizationId: null,
      course: NIGHTKLASS_COURSE,
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search ? { questionText: this.text(q.search) } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        ...this.page(q),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          questionText: true,
          questionType: true,
          difficulty: true,
          status: true,
          topic: { select: { name: true } },
          course: { select: COURSE_SUMMARY },
        },
      }),
      this.prisma.question.count({ where }),
    ])
    return this.result(items, total, q)
  }
  async question(id: string) {
    const q = await this.prisma.question.findFirst({
      where: { id, organizationId: null, course: NIGHTKLASS_COURSE },
    })
    if (!q) throw new NotFoundException('Nightklass question not found')
    return q
  }
  async saveQuestion(id: string | null, dto: AdminQuestionDto, actorId: string) {
    validateQuestion(dto)
    return this.transaction(actorId, async (tx) => {
      const topic = await tx.topic.findFirst({
        where: { id: dto.topicId, archivedAt: null, course: NIGHTKLASS_COURSE },
        include: { course: { select: { id: true, ownerId: true } } },
      })
      if (!topic) throw new NotFoundException('Active Nightklass topic not found')
      if (id) {
        const existing = await tx.question.findFirst({
          where: { id, organizationId: null, course: NIGHTKLASS_COURSE },
        })
        if (!existing) throw new NotFoundException('Nightklass question not found')
        if (existing.topicId !== dto.topicId)
          throw new BadRequestException('A saved question cannot be moved to another topic')
        const used = await tx.selfQuizAttempt.count({
          where: { topicId: dto.topicId, results: { array_contains: [{ questionId: id }] } },
        })
        if (used)
          throw new ConflictException(
            'This question has graded attempts. Create a new question to preserve assessment integrity.',
          )
      }
      const { reason, options, ...fields } = dto
      const data = {
        ...fields,
        options:
          dto.questionType === 'MCQ'
            ? (options as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        courseId: topic.course.id,
      }
      const result = id
        ? await tx.question.update({ where: { id }, data })
        : await tx.question.create({
            data: { ...data, createdById: topic.course.ownerId!, tags: [] },
          })
      await this.audit(
        tx,
        actorId,
        id ? 'QUESTION_UPDATED' : 'QUESTION_CREATED',
        'question',
        result.id,
        { reason },
      )
      return result
    })
  }

  async documents(q: AdminQueryDto) {
    this.assertStatus(q, ['UPLOADING', 'PROCESSING', 'READY', 'FAILED'])
    const where: Prisma.DocumentWhereInput = {
      organizationId: null,
      uploadedBy: NIGHTKLASS_USER,
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search ? { fileName: this.text(q.search) } : {}),
      ...(q.courseId ? { courseId: q.courseId } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        ...this.page(q),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSizeBytes: true,
          status: true,
          pageCount: true,
          chunkCount: true,
          createdAt: true,
          uploadedBy: { select: { name: true } },
          course: { select: COURSE_SUMMARY },
        },
      }),
      this.prisma.document.count({ where }),
    ])
    return this.result(items, total, q)
  }
  async reports(q: AdminQueryDto) {
    this.assertStatus(q, ['OPEN', 'RESOLVED', 'DISMISSED'])
    const where: Prisma.ContentReportWhereInput = {
      lesson: { topic: { course: NIGHTKLASS_COURSE } },
      ...(q.status ? { status: q.status } : {}),
      ...(q.search ? { reason: this.text(q.search) } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.contentReport.findMany({
        where,
        ...this.page(q),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          lesson: { select: { id: true, version: true, topic: { select: { name: true } } } },
        },
      }),
      this.prisma.contentReport.count({ where }),
    ])
    return this.result(items, total, q)
  }
  async resolveReport(id: string, dto: AdminReportDto, actorId: string) {
    return this.transaction(actorId, async (tx) => {
      const report = await tx.contentReport.findFirst({
        where: { id, lesson: { topic: { course: NIGHTKLASS_COURSE } } },
      })
      if (!report) throw new NotFoundException('Nightklass report not found')
      const result = await tx.contentReport.update({
        where: { id },
        data: {
          status: dto.status,
          resolution: dto.reason,
          resolvedById: dto.status === 'OPEN' ? null : actorId,
          resolvedAt: dto.status === 'OPEN' ? null : new Date(),
        },
      })
      await this.audit(tx, actorId, 'REPORT_STATUS_CHANGED', 'report', id, {
        status: dto.status,
        reason: dto.reason,
      })
      return result
    })
  }
  async auditLogs(q: AdminQueryDto) {
    const where: Prisma.NightklassAdminAuditWhereInput = q.search
      ? {
          OR: [
            { action: this.text(q.search) },
            { resourceId: this.text(q.search) },
            { actor: { name: this.text(q.search) } },
          ],
        }
      : {}
    const [items, total] = await Promise.all([
      this.prisma.nightklassAdminAudit.findMany({
        where,
        ...this.page(q),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { actor: { select: { name: true } } },
      }),
      this.prisma.nightklassAdminAudit.count({ where }),
    ])
    return this.result(items, total, q)
  }
}
