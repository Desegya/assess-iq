import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { CreateAssessmentDto } from './dto/create-assessment.dto'
import { AddQuestionsDto } from './dto/add-questions.dto'
import { UpdateAssessmentDto } from './dto/update-assessment.dto'

// Default assessment settings applied on creation
const DEFAULT_SETTINGS = {
  shuffleQuestions: false,
  shuffleOptions: false,
  showResultsImmediately: true,
  allowReview: true,
  maxAttempts: 1,
}

// Reusable question select shape
const QUESTION_SELECT = {
  id: true,
  order: true,
  scoreWeight: true,
  question: {
    select: {
      id: true,
      questionText: true,
      questionType: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      difficulty: true,
      status: true,
    },
  },
}

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateAssessmentDto, user: AuthUser) {
    if (!user.organizationId) {
      throw new ForbiddenException('You must belong to an organisation')
    }

    // Verify the course belongs to this org
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, organizationId: user.organizationId },
    })
    if (!course) throw new NotFoundException('Course not found')

    return this.prisma.assessment.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description ?? null,
        instructions: dto.instructions ?? null,
        durationMinutes: dto.durationMinutes,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        endTime: dto.endTime ? new Date(dto.endTime) : null,
        settings: DEFAULT_SETTINGS,
        status: 'DRAFT',
        totalQuestions: 0,
        totalMarks: 0,
      },
      include: {
        course: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findAll(user: AuthUser, filters: { courseId?: string; status?: string } = {}) {
    if (!user.organizationId) return []

    return this.prisma.assessment.findMany({
      where: {
        organizationId: user.organizationId,
        // Teachers only see their own; admins see all
        ...(user.role === UserRole.TEACHER ? { createdById: user.id } : {}),
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    })
  }

  // ─── Get published assessments for students ───────────────────────────────

  async findPublished(user: AuthUser) {
    if (!user.organizationId) return []

    return this.prisma.assessment.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: ['PUBLISHED', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, description: true, durationMinutes: true,
        status: true, totalQuestions: true, startTime: true, endTime: true,
        settings: true,
        course: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
      },
    })
  }

  // ─── Single ───────────────────────────────────────────────────────────────

  async findOne(id: string, user: AuthUser) {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id,
        organizationId: user.organizationId ?? undefined,
      },
      include: {
        course: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        questions: {
          orderBy: { order: 'asc' },
          select: QUESTION_SELECT,
        },
        _count: { select: { attempts: true } },
      },
    })
    if (!assessment) throw new NotFoundException('Assessment not found')
    return assessment
  }

  // ─── Add questions ────────────────────────────────────────────────────────

  async addQuestions(id: string, dto: AddQuestionsDto, user: AuthUser) {
    const assessment = await this.findOne(id, user)
    this.assertCanEdit(assessment, user)

    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT assessments can be modified')
    }

    // Verify all questions belong to this org
    const questions = await this.prisma.question.findMany({
      where: {
        id: { in: dto.questionIds },
        organizationId: user.organizationId ?? undefined,
      },
      select: { id: true },
    })

    if (questions.length !== dto.questionIds.length) {
      throw new BadRequestException('One or more questions not found')
    }

    // Get current max order
    const lastOrder = await this.prisma.assessmentQuestion.findFirst({
      where: { assessmentId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    let nextOrder = (lastOrder?.order ?? 0) + 1

    // Upsert (skip duplicates)
    const existing = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: id },
      select: { questionId: true },
    })
    const existingIds = new Set(existing.map(e => e.questionId))
    const newIds = dto.questionIds.filter(qId => !existingIds.has(qId))

    if (newIds.length > 0) {
      await this.prisma.assessmentQuestion.createMany({
        data: newIds.map(questionId => ({
          assessmentId: id,
          questionId,
          order: nextOrder++,
          scoreWeight: 1,
        })),
      })
    }

    // Update totalQuestions / totalMarks
    const count = await this.prisma.assessmentQuestion.count({ where: { assessmentId: id } })
    await this.prisma.assessment.update({
      where: { id },
      data: { totalQuestions: count, totalMarks: count },
    })

    return this.findOne(id, user)
  }

  // ─── Remove a question ────────────────────────────────────────────────────

  async removeQuestion(id: string, questionId: string, user: AuthUser) {
    const assessment = await this.findOne(id, user)
    this.assertCanEdit(assessment, user)

    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT assessments can be modified')
    }

    await this.prisma.assessmentQuestion.deleteMany({
      where: { assessmentId: id, questionId },
    })

    const count = await this.prisma.assessmentQuestion.count({ where: { assessmentId: id } })
    await this.prisma.assessment.update({
      where: { id },
      data: { totalQuestions: count, totalMarks: count },
    })

    return this.findOne(id, user)
  }

  // ─── Publish ──────────────────────────────────────────────────────────────

  async publish(id: string, user: AuthUser) {
    const assessment = await this.findOne(id, user)
    this.assertCanEdit(assessment, user)

    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT assessments can be published')
    }
    if (assessment.totalQuestions === 0) {
      throw new BadRequestException('Add at least one question before publishing')
    }

    return this.prisma.assessment.update({
      where: { id },
      data: { status: 'PUBLISHED' },
      select: { id: true, status: true, title: true },
    })
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateAssessmentDto, user: AuthUser) {
    const assessment = await this.findOne(id, user)
    this.assertCanEdit(assessment, user)

    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT assessments can be edited')
    }

    // Merge incoming settings with existing defaults
    const existingSettings = (assessment.settings as Record<string, unknown>) ?? {}
    const newSettings = dto.settings ? { ...existingSettings, ...dto.settings } : undefined

    return this.prisma.assessment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description ?? null }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions ?? null }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime ? new Date(dto.startTime) : null }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime ? new Date(dto.endTime) : null }),
        ...(newSettings !== undefined && { settings: newSettings }),
      },
      include: {
        course: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        questions: { orderBy: { order: 'asc' }, select: QUESTION_SELECT },
        _count: { select: { attempts: true } },
      },
    })
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async delete(id: string, user: AuthUser) {
    const assessment = await this.findOne(id, user)
    this.assertCanEdit(assessment, user)

    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT assessments can be deleted')
    }
    if (assessment._count.attempts > 0) {
      throw new BadRequestException('Cannot delete an assessment that already has attempts')
    }

    await this.prisma.assessmentQuestion.deleteMany({ where: { assessmentId: id } })
    await this.prisma.assessment.delete({ where: { id } })

    return { message: 'Assessment deleted' }
  }

  // ─── Archive ──────────────────────────────────────────────────────────────

  async archive(id: string, user: AuthUser) {
    const assessment = await this.findOne(id, user)
    this.assertCanEdit(assessment, user)

    return this.prisma.assessment.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      select: { id: true, status: true },
    })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private assertCanEdit(assessment: { createdById: string }, user: AuthUser) {
    const canEdit =
      assessment.createdById === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canEdit) throw new ForbiddenException('You cannot modify this assessment')
  }
}
