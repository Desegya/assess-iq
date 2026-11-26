import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import { AuthUser, UserRole, QuestionType } from '@assessiq/types'
import { GenerateQuestionsDto } from './dto/generate-questions.dto'
import { UpdateQuestionDto } from './dto/update-question.dto'
import { SimulateQuestionsDto } from './dto/simulate-questions.dto'
import { BulkCreateQuestionsDto, CreateQuestionDto } from './dto/create-question.dto'
import { QUESTION_BANK, scoreQuestion, buildTemplateQuestions } from './question-bank'

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  // ─── Generate ─────────────────────────────────────────────────────────────

  async generate(dto: GenerateQuestionsDto, user: AuthUser) {
    if (!user.organizationId) {
      throw new ForbiddenException('You must belong to an organisation')
    }

    // 1. Load the document
    const doc = await this.prisma.document.findFirst({
      where: { id: dto.documentId, organizationId: user.organizationId },
    })
    if (!doc) throw new NotFoundException('Document not found')
    if (doc.status !== 'READY') {
      throw new BadRequestException(
        'Document is not ready yet — wait for text extraction to finish',
      )
    }
    if (doc.courseId && doc.materialReviewStatus !== 'APPROVED')
      throw new BadRequestException(
        'Confirm that this file belongs to its course before generating questions.',
      )
    if (!doc.extractedText) {
      throw new BadRequestException('Document has no extracted text')
    }

    // 2. Call Claude
    const rawQuestions = await this.ai.generateQuestions(doc.extractedText, {
      count: dto.count,
      types: dto.types,
      difficulty: dto.difficulty,
      topicHint: dto.topicHint,
      userId: user.id,
      organizationId: user.organizationId,
      documentId: doc.id,
    })

    // 3. Save all generated questions to DB
    const saved = await Promise.all(
      rawQuestions.map((q) =>
        this.prisma.question.create({
          data: {
            organizationId: user.organizationId!,
            createdById: user.id,
            courseId: doc.courseId ?? null,
            sourceDocumentId: doc.id,
            questionText: q.questionText,
            questionType: this.mapType(q.type),
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? null,
            difficulty: dto.difficulty,
            status: 'DRAFT',
            isAiGenerated: true,
            tags: [],
          },
        }),
      ),
    )

    return { count: saved.length, questions: saved }
  }

  // ─── Simulate (no AI credits needed) ─────────────────────────────────────

  async simulate(dto: SimulateQuestionsDto, user: AuthUser) {
    if (!user.organizationId) {
      throw new ForbiddenException('You must belong to an organisation')
    }

    const requestedTypes = dto.types as string[]
    const searchTerms = [
      ...dto.topic.toLowerCase().split(/\s+/),
      ...(dto.subject?.toLowerCase().split(/\s+/) ?? []),
    ].filter(Boolean)

    // Score and filter bank questions
    const scored = QUESTION_BANK.filter((q) => requestedTypes.includes(q.type))
      .map((q) => ({ q, score: scoreQuestion(q, searchTerms) }))
      .sort((a, b) => b.score - a.score || Math.random() - 0.5)

    const picked = scored.slice(0, dto.count).map((s) => s.q)

    // Fill any gap with templates
    const shortfall = dto.count - picked.length
    if (shortfall > 0) {
      const templates = buildTemplateQuestions(dto.topic, requestedTypes, dto.difficulty, shortfall)
      picked.push(...templates)
    }

    // Verify course belongs to org if provided
    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: dto.courseId, organizationId: user.organizationId },
      })
      if (!course) throw new BadRequestException('Course not found')
    }

    // Save to DB
    const saved = await Promise.all(
      picked.map((q) =>
        this.prisma.question.create({
          data: {
            organizationId: user.organizationId!,
            createdById: user.id,
            courseId: dto.courseId ?? null,
            questionText: q.questionText,
            questionType: this.mapType(q.type),
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? null,
            difficulty: dto.difficulty,
            status: 'DRAFT',
            isAiGenerated: false,
            tags: [],
          },
        }),
      ),
    )

    return { count: saved.length, questions: saved }
  }

  // ─── Teacher-written questions ────────────────────────────────────────────

  async create(dto: CreateQuestionDto, user: AuthUser) {
    const { count, questions } = await this.createMany({ questions: [dto] }, user)
    return count === 1 ? questions[0] : questions
  }

  /**
   * Save teacher-written questions (typed in, or rows of an imported question paper).
   * All rows are validated first and saved together, so a bad row never leaves half a paper behind.
   * The teacher wrote them, so they are saved as APPROVED and ready to add to an assessment.
   */
  async createMany(dto: BulkCreateQuestionsDto, user: AuthUser) {
    if (!user.organizationId) {
      throw new ForbiddenException('You must belong to an organisation')
    }
    const organizationId = user.organizationId

    const problems: string[] = []
    const rows = dto.questions.map((q, i) => {
      const problem = questionProblem(q)
      if (problem) problems.push(`Question ${i + 1}: ${problem}`)
      return { ...q, courseId: q.courseId ?? dto.courseId ?? null }
    })
    if (problems.length) throw new BadRequestException(problems.slice(0, 20))

    const courseIds = [...new Set(rows.map(r => r.courseId).filter((id): id is string => !!id))]
    if (courseIds.length) {
      const found = await this.prisma.course.count({ where: { id: { in: courseIds }, organizationId } })
      if (found !== courseIds.length) throw new BadRequestException('Course not found')
    }

    const questions = await this.prisma.$transaction(
      rows.map(q =>
        this.prisma.question.create({
          data: {
            organizationId,
            createdById: user.id,
            courseId: q.courseId,
            questionText: q.questionText.trim(),
            questionType: q.questionType,
            options:
              q.questionType === QuestionType.MCQ
                ? q.options!.map(o => ({ key: o.key.trim().toUpperCase(), text: o.text.trim() }))
                : undefined,
            correctAnswer: normaliseAnswer(q),
            explanation: q.explanation?.trim() || null,
            difficulty: q.difficulty,
            status: 'APPROVED',
            isAiGenerated: false,
            tags: [],
          },
        }),
      ),
    )
    return { count: questions.length, questions }
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findAll(
    user: AuthUser,
    filters: { courseId?: string; documentId?: string; status?: string },
  ) {
    if (!user.organizationId) return []

    return this.prisma.question.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.role === UserRole.TEACHER ? { createdById: user.id } : {}),
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
        ...(filters.documentId ? { sourceDocumentId: filters.documentId } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        sourceDocument: { select: { id: true, fileName: true } },
        course: { select: { id: true, title: true } },
      },
    })
  }

  // ─── Single ───────────────────────────────────────────────────────────────

  async findOne(id: string, user: AuthUser) {
    const q = await this.prisma.question.findFirst({
      where: user.organizationId
        ? { id, organizationId: user.organizationId }
        : { id, organizationId: null, createdById: user.id },
    })
    if (!q) throw new NotFoundException('Question not found')
    return q
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateQuestionDto, user: AuthUser) {
    const q = await this.findOne(id, user)

    const canEdit =
      q.createdById === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canEdit) throw new ForbiddenException('You cannot edit this question')

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.questionText !== undefined && { questionText: dto.questionText }),
        // options is a Json field in Prisma — cast through unknown
        ...(dto.options !== undefined && { options: dto.options as unknown as never }),
        ...(dto.correctAnswer !== undefined && { correctAnswer: dto.correctAnswer }),
        ...(dto.explanation !== undefined && { explanation: dto.explanation }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    })
  }

  // ─── Approve shortcut ─────────────────────────────────────────────────────

  async approve(id: string, user: AuthUser) {
    return this.update(id, { status: 'APPROVED' } as UpdateQuestionDto, user)
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, user: AuthUser) {
    const q = await this.findOne(id, user)

    const canDelete =
      q.createdById === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canDelete) throw new ForbiddenException('You cannot delete this question')

    await this.prisma.question.delete({ where: { id } })
    return { message: 'Question deleted' }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private mapType(raw: string): QuestionType {
    const map: Record<string, QuestionType> = {
      MCQ: QuestionType.MCQ,
      TRUE_FALSE: QuestionType.TRUE_FALSE,
      SHORT_ANSWER: QuestionType.SHORT_ANSWER,
      THEORY: QuestionType.THEORY,
    }
    return map[raw] ?? QuestionType.MCQ
  }
}

// ─── Validation for teacher-written questions ───────────────────────────────

function questionProblem(q: CreateQuestionDto): string | null {
  if (q.questionType === QuestionType.MCQ) {
    const options = q.options ?? []
    if (options.length < 2) return 'a multiple-choice question needs at least two options'
    const keys = options.map(o => o.key.trim().toUpperCase())
    if (new Set(keys).size !== keys.length) return 'option letters must be different'
    if (!keys.includes(q.correctAnswer.trim().toUpperCase()))
      return `the correct answer "${q.correctAnswer}" is not one of the options (${keys.join(', ')})`
    return null
  }
  if (q.questionType === QuestionType.TRUE_FALSE) {
    return /^(true|false)$/i.test(q.correctAnswer.trim()) ? null : 'the answer to a true/false question must be True or False'
  }
  return null
}

function normaliseAnswer(q: Pick<CreateQuestionDto, 'questionType' | 'correctAnswer'>): string {
  const answer = q.correctAnswer.trim()
  if (q.questionType === QuestionType.MCQ) return answer.toUpperCase()
  if (q.questionType === QuestionType.TRUE_FALSE) return /^true$/i.test(answer) ? 'True' : 'False'
  return answer
}
