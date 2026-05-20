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
      throw new BadRequestException('Document is not ready yet — wait for text extraction to finish')
    }
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
      rawQuestions.map(q =>
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
      where: { id, organizationId: user.organizationId ?? undefined },
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
