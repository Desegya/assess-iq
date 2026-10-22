import { serializable } from '../../common/serializable'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@assessiq/db'
import { AuthUser, UserRole } from '@assessiq/types'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import {
  BankPracticeDto,
  BankQuestionDto,
  BankStateDto,
  ContentFilterDto,
  CreateExamMaterialDto,
  EditBankQuestionDto,
  GenerateBankDto,
} from './exam-content.dto'
import { questionFingerprint, subjectIdentity, validateBankQuestion } from './exam-content.rules'

@Injectable()
export class ExamContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  private filter(q: ContentFilterDto) {
    return {
      exam: q.exam,
      subjectKey: q.subject ? subjectIdentity(q.subject) : undefined,
      topic: q.topic ? { contains: q.topic, mode: 'insensitive' as const } : undefined,
      status: q.status,
    }
  }
  async materials(q: ContentFilterDto) {
    const where = this.filter(q)
    const [items, total] = await Promise.all([
      this.prisma.examMaterial.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: (q.page - 1) * 20,
        select: {
          id: true,
          exam: true,
          subject: true,
          topic: true,
          title: true,
          sourceNote: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.examMaterial.count({ where }),
    ])
    return { items, total, page: q.page }
  }
  async material(id: string) {
    const material = await this.prisma.examMaterial.findUnique({ where: { id } })
    if (!material) throw new NotFoundException('Material not found')
    return material
  }
  async questions(q: ContentFilterDto) {
    const where = this.filter(q)
    const [items, total] = await Promise.all([
      this.prisma.examBankQuestion.findMany({
        where,
        include: { objectiveLinks: { select: { objectiveId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: (q.page - 1) * 20,
      }),
      this.prisma.examBankQuestion.count({ where }),
    ])
    return { items, total, page: q.page }
  }
  private async mutate<T>(
    actorId: string,
    action: string,
    fn: (tx: Prisma.TransactionClient) => Promise<{ result: T; id: string }>,
  ) {
    try {
      return await serializable(this.prisma, 
        async (tx) => {
          const actor = await tx.nightklassAdmin.findUnique({
            where: { userId: actorId },
            include: { user: { select: { status: true, organizationId: true } } },
          })
          if (!actor || actor.user.status !== 'ACTIVE' || actor.user.organizationId)
            throw new ForbiddenException('Active Nightklass administrator access required')
          const { result, id } = await fn(tx)
          await tx.nightklassAdminAudit.create({
            data: { actorId, action, resourceType: 'exam-content', resourceId: id },
          })
          return result
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        ['P2002', 'P2034'].includes(String(err.code))
      )
        throw new ConflictException(
          'Duplicate content or concurrent change. Refresh and try again.',
        )
      throw err
    }
  }
  createMaterial(dto: CreateExamMaterialDto, actorId: string) {
    return this.mutate(actorId, 'exam.material.create', async (tx) => {
      const result = await tx.examMaterial.create({
        data: { ...dto, subjectKey: subjectIdentity(dto.subject), createdById: actorId },
      })
      return { result, id: result.id }
    })
  }
  materialState(id: string, status: 'APPROVED' | 'ARCHIVED', actorId: string) {
    return this.mutate(actorId, 'exam.material.' + status.toLowerCase(), async (tx) => {
      const material = await tx.examMaterial.findUnique({ where: { id } })
      if (!material) throw new NotFoundException('Material not found')
      const result = await tx.examMaterial.update({ where: { id }, data: { status } })
      return { result, id }
    })
  }
  private async objectiveLinks(
    tx: Prisma.TransactionClient,
    exam: BankQuestionDto['exam'],
    subject: string,
    ids?: string[],
  ) {
    if (!ids?.length) return undefined
    const unique = [...new Set(ids)]
    const found = await tx.examSyllabusObjective.count({
      where: {
        id: { in: unique },
        syllabus: { exam, subjectKey: subjectIdentity(subject), status: { not: 'ARCHIVED' } },
      },
    })
    if (found !== unique.length)
      throw new BadRequestException(
        'Objective mapping must match the exam and subject in a current syllabus',
      )
    return { create: unique.map((objectiveId) => ({ objectiveId })) }
  }
  async mapObjectives(id: string, ids: string[], expectedRevision: number, actorId: string) {
    return this.mutate(actorId, 'exam.question.map-objectives', async (tx) => {
      const question = await tx.examBankQuestion.findUnique({ where: { id } })
      if (!question) throw new NotFoundException('Question not found')
      if (question.revision !== expectedRevision || question.status !== 'DRAFT')
        throw new ConflictException('Map objectives on the current draft before publication')
      const links = await this.objectiveLinks(
        tx,
        question.exam as BankQuestionDto['exam'],
        question.subject,
        ids,
      )
      await tx.examQuestionObjective.deleteMany({ where: { questionId: id } })
      const result = await tx.examBankQuestion.update({
        where: { id },
        data: { objectiveLinks: links, revision: { increment: 1 } },
      })
      return { id, result }
    })
  }
  async correction(id: string, expectedRevision: number, actorId: string) {
    return this.mutate(actorId, 'exam.question.correct', async (tx) => {
      const question = await tx.examBankQuestion.findUnique({
        where: { id },
        include: { objectiveLinks: true },
      })
      if (!question) throw new NotFoundException('Question not found')
      if (
        question.revision !== expectedRevision ||
        !['APPROVED', 'ARCHIVED'].includes(question.status)
      )
        throw new ConflictException(
          'Create corrections from the current published or archived version',
        )
      const { id: oldId, objectiveLinks, createdAt, updatedAt, reviewedById, ...fields } = question
      const result = await tx.examBankQuestion.create({
        data: {
          ...fields,
          options: fields.options ?? Prisma.JsonNull,
          supersedesId: oldId,
          generationJobId: null,
          status: 'DRAFT',
          revision: 1,
          createdById: actorId,
          fingerprint: questionFingerprint(question.questionText) + ':correction:' + oldId,
          objectiveLinks: {
            create: objectiveLinks.map((link) => ({ objectiveId: link.objectiveId })),
          },
        },
        include: { objectiveLinks: true },
      })
      return { id: result.id, result }
    })
  }
  async createQuestion(dto: BankQuestionDto, actorId: string) {
    validateBankQuestion(dto)
    return this.mutate(actorId, 'exam.question.create', async (tx) => {
      const { objectiveIds, ...fields } = dto
      const links = await this.objectiveLinks(tx, dto.exam, dto.subject, objectiveIds)
      const result = await tx.examBankQuestion.create({
        data: {
          ...fields,
          objectiveLinks: links,
          options: dto.options as Prisma.InputJsonValue | undefined,
          subjectKey: subjectIdentity(dto.subject),
          fingerprint: questionFingerprint(dto.questionText),
          createdById: actorId,
        },
      })
      return { result, id: result.id }
    })
  }
  async generate(dto: GenerateBankDto, actorId: string, job?: { id: string; leaseUntil: Date }) {
    if (dto.exam === 'JAMB' && dto.questionType !== 'MCQ')
      throw new BadRequestException('JAMB questions must be multiple choice')
    let body = `Nigerian senior secondary subject: ${dto.subject}. Exam-style practice for ${dto.exam}. Topic/objectives: ${dto.topic}. Generate original questions, not claimed past questions. Include a model answer and substantive explanation for each question. MCQ questions require four A–D options. Do not refer to absent passages or diagrams.`
    if (dto.objectiveIds?.length) {
      const objectives = await this.prisma.examSyllabusObjective.findMany({
        where: {
          id: { in: dto.objectiveIds },
          syllabus: {
            exam: dto.exam,
            subjectKey: subjectIdentity(dto.subject),
            status: { not: 'ARCHIVED' },
          },
        },
      })
      if (objectives.length !== new Set(dto.objectiveIds).size)
        throw new BadRequestException('Select matching syllabus objectives')
      body +=
        '\nLEARNING OBJECTIVES:\n' +
        objectives.map((o) => o.code + ': ' + o.title + ' — ' + o.description).join('\n')
    }
    if (dto.materialId) {
      const material = await this.prisma.examMaterial.findFirst({
        where: {
          id: dto.materialId,
          exam: dto.exam,
          subjectKey: subjectIdentity(dto.subject),
          status: { not: 'ARCHIVED' },
        },
      })
      if (!material) throw new NotFoundException('Matching material not found')
      body += '\n\nTEACHER MATERIAL:\n' + material.body
    }
    const raw = await this.ai.generateQuestions(body, {
      count: dto.count,
      types: [dto.questionType],
      difficulty: dto.difficulty,
      topicHint: `${dto.exam} ${dto.subject}: ${dto.topic}`,
      userId: actorId,
      documentId: dto.materialId ?? 'exam-bank',
      groundedInMaterial: false,
    })
    const accepted: BankQuestionDto[] = []
    let rejected = Math.max(0, raw.length - dto.count)
    for (const item of raw.slice(0, dto.count)) {
      const candidate = plainToInstance(BankQuestionDto, {
        exam: dto.exam,
        subject: dto.subject,
        topic: dto.topic,
        questionText: item.questionText,
        questionType: item.type,
        options: item.options,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation,
        marks: item.marks ?? 1,
        difficulty: dto.difficulty,
      })
      try {
        if ((await validate(candidate)).length || candidate.questionType !== dto.questionType)
          throw new Error('Invalid output')
        validateBankQuestion(candidate)
        accepted.push(candidate)
      } catch {
        rejected++
      }
    }
    if (!accepted.length)
      throw new BadRequestException(
        'AI returned no valid questions. Try a smaller batch or clearer topic.',
      )
    return this.mutate(actorId, 'exam.questions.generate', async (tx) => {
      if (
        job &&
        !(await tx.examGenerationJob.findFirst({
          where: { id: job.id, status: 'RUNNING', leaseUntil: job.leaseUntil },
        }))
      )
        throw new ConflictException(
          'Generation lease changed; this batch will be recovered by the worker',
        )
      const data = accepted.map((q) => ({
        ...q,
        options: q.options as Prisma.InputJsonValue | undefined,
        materialId: dto.materialId,
        generationJobId: job?.id,
        subjectKey: subjectIdentity(q.subject),
        fingerprint: questionFingerprint(q.questionText),
        isAiGenerated: true,
        createdById: actorId,
      }))
      const links = await this.objectiveLinks(tx, dto.exam, dto.subject, dto.objectiveIds)
      const result = await tx.examBankQuestion.createMany({ data, skipDuplicates: true })
      if (links) {
        const drafts = await tx.examBankQuestion.findMany({
          where: {
            exam: dto.exam,
            subjectKey: subjectIdentity(dto.subject),
            createdById: actorId,
            status: 'DRAFT',
            fingerprint: { in: data.map((q) => q.fingerprint) },
          },
          select: { id: true },
        })
        await tx.examQuestionObjective.createMany({
          data: drafts.flatMap((q) =>
            links.create.map((link) => ({ questionId: q.id, objectiveId: link.objectiveId })),
          ),
          skipDuplicates: true,
        })
      }
      const summary = { saved: result.count, rejected, duplicates: accepted.length - result.count }
      if (job)
        await tx.examGenerationJob.update({
          where: { id: job.id },
          data: { status: 'SUCCEEDED', leaseUntil: null, error: null, result: summary },
        })
      return { result: summary, id: dto.materialId ?? 'syllabus-generation' }
    })
  }
  editQuestion(id: string, dto: EditBankQuestionDto, actorId: string) {
    validateBankQuestion(dto)
    const { expectedRevision, objectiveIds, ...data } = dto
    return this.mutate(actorId, 'exam.question.edit', async (tx) => {
      const current = await tx.examBankQuestion.findUnique({ where: { id } })
      if (!current) throw new NotFoundException('Question not found')
      if (
        current.supersedesId &&
        (current.exam !== dto.exam || current.subjectKey !== subjectIdentity(dto.subject))
      )
        throw new BadRequestException('A correction must retain its exam and subject')
      const links = objectiveIds
        ? await this.objectiveLinks(tx, dto.exam, dto.subject, objectiveIds)
        : undefined
      const fingerprint =
        questionFingerprint(data.questionText) +
        (current.supersedesId ? ':correction:' + current.supersedesId : '')
      const updated = await tx.examBankQuestion.updateMany({
        where: { id, revision: expectedRevision, status: 'DRAFT' },
        data: {
          ...data,
          options: data.options as Prisma.InputJsonValue | undefined,
          subjectKey: subjectIdentity(data.subject),
          fingerprint,
          revision: { increment: 1 },
        },
      })
      if (updated.count !== 1)
        throw new ConflictException('Only the current draft can be edited. Refresh the question.')
      if (objectiveIds) {
        await tx.examQuestionObjective.deleteMany({ where: { questionId: id } })
        if (links)
          await tx.examQuestionObjective.createMany({
            data: links.create.map((link) => ({ questionId: id, objectiveId: link.objectiveId })),
          })
      }
      return { result: await tx.examBankQuestion.findUniqueOrThrow({ where: { id } }), id }
    })
  }
  questionState(id: string, dto: BankStateDto, actorId: string) {
    return this.mutate(actorId, 'exam.question.' + dto.status.toLowerCase(), async (tx) => {
      const question = await tx.examBankQuestion.findUnique({ where: { id } })
      if (!question) throw new NotFoundException('Question not found')
      if (question.revision !== dto.expectedRevision)
        throw new ConflictException('Question changed. Refresh before reviewing.')
      if (dto.status === 'APPROVED') {
        if (question.status !== 'DRAFT')
          throw new ConflictException('Only draft questions can be published')
        if (question.supersedesId)
          await tx.examBankQuestion.update({
            where: { id: question.supersedesId },
            data: { status: 'ARCHIVED', revision: { increment: 1 } },
          })
        validateBankQuestion({
          ...question,
          options: question.options as unknown as BankQuestionDto['options'],
        } as BankQuestionDto)
      }
      const result = await tx.examBankQuestion.update({
        where: { id },
        data: { status: dto.status, reviewedById: actorId, revision: { increment: 1 } },
      })
      return { result, id }
    })
  }
  private assertLearner(user: AuthUser) {
    if (user.organizationId || user.role !== UserRole.STUDENT)
      throw new ForbiddenException('Standalone learner access required')
  }
  async learnerMaterials(goalId: string, subjectKey: string, user: AuthUser) {
    this.assertLearner(user)
    const subject = await this.prisma.examGoalSubject.findFirst({
      where: { goalId, subjectKey, goal: { studentId: user.id } },
      include: { goal: true },
    })
    if (!subject) throw new NotFoundException('Exam subject not found')
    return this.prisma.examMaterial.findMany({
      where: { exam: subject.goal.exam, subjectKey, status: 'APPROVED' },
      select: { id: true, title: true, topic: true, body: true, sourceNote: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
  }
  async practice(dto: BankPracticeDto, user: AuthUser) {
    this.assertLearner(user)
    const subject = await this.prisma.examGoalSubject.findFirst({
      where: {
        goalId: dto.goalId,
        subjectKey: dto.subjectKey,
        goal: { studentId: user.id },
        course: { ownerId: user.id },
      },
      include: { goal: true },
    })
    if (!subject) throw new NotFoundException('Exam subject not found')
    const objective = dto.objectiveId
      ? await this.prisma.examSyllabusObjective.findFirst({
          where: {
            id: dto.objectiveId,
            syllabus: {
              exam: subject.goal.exam,
              year: subject.goal.year,
              subjectKey: subject.subjectKey,
              status: 'APPROVED',
            },
          },
        })
      : null
    if (dto.objectiveId && !objective)
      throw new NotFoundException('Published objective not found for this goal')
    const bank = await this.prisma.examBankQuestion.findMany({
      where: {
        exam: subject.goal.exam,
        subjectKey: subject.subjectKey,
        status: 'APPROVED',
        ...(objective ? { objectiveLinks: { some: { objectiveId: objective.id } } } : {}),
        ...(!objective && dto.topic
          ? { topic: { contains: dto.topic, mode: 'insensitive' as const } }
          : {}),
      },
      take: 1000,
      orderBy: { id: 'asc' },
    })
    if (!bank.length)
      throw new BadRequestException(
        'No reviewed questions match yet. You can generate personal topic practice in your subject workspace.',
      )
    // Uniform shuffle of the bounded candidate pool; bank growth can replace this with indexed sampling.
    for (let i = bank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[bank[i], bank[j]] = [bank[j]!, bank[i]!]
    }
    return this.prisma.$transaction(async (tx) => {
      const name = objective?.title ?? `${subject.goal.exam} reviewed practice`
      let topic = await tx.topic.findFirst({
        where: { courseId: subject.courseId, name, archivedAt: null },
      })
      if (!topic)
        topic = await tx.topic.create({
          data: {
            courseId: subject.courseId,
            name,
            description: objective?.description,
            source: objective ? 'OUTLINE' : 'STUDENT',
            order: objective?.order ?? 10000,
          },
        })
      if (objective)
        await tx.examObjectiveStudyLink.upsert({
          where: { studentId_objectiveId: { studentId: user.id, objectiveId: objective.id } },
          create: { studentId: user.id, objectiveId: objective.id, topicId: topic.id },
          update: {},
        })
      const questions = []
      for (const q of bank.slice(0, dto.count)) {
        // Copies freeze reviewed content and leave private quiz history untouched by later bank changes.
        const copy = await tx.question.create({
          data: {
            createdById: user.id,
            courseId: subject.courseId,
            topicId: topic.id,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options ?? Prisma.JsonNull,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty,
            marks: q.marks,
            status: 'APPROVED',
            sourceExamBankQuestionId: q.id,
            isAiGenerated: q.isAiGenerated,
            tags: ['exam-bank', q.id, `revision:${q.revision}`, q.topic],
          },
          select: {
            id: true,
            questionText: true,
            questionType: true,
            options: true,
            marks: true,
            difficulty: true,
          },
        })
        questions.push(copy)
      }
      return {
        topicId: topic.id,
        requestedCount: dto.count,
        actualCount: questions.length,
        questions,
      }
    })
  }
}
