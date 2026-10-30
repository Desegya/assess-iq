import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AiService, type LessonContent, type LessonExcerpt } from '../ai/ai.service'
import { CoursesService } from '../courses/courses.service'
import { describeCourse } from '../courses/describe-course'
import { AuthUser } from '@assessiq/types'
import { RetrievalService } from './retrieval.service'
import { GenerateLessonDto } from './dto/lesson.dto'
import { sanitizeLesson } from './lesson-content'
import { LessonVisualsService } from './lesson-visuals.service'

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly coursesService: CoursesService,
    private readonly retrieval: RetrievalService,
    private readonly visuals: LessonVisualsService,
  ) {}

  private async loadTopic(topicId: string, user: AuthUser) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { subTopics: { where: { archivedAt: null }, orderBy: { order: 'asc' } } },
    })
    if (!topic) throw new NotFoundException('Topic not found')
    const course = await this.coursesService.findOne(topic.courseId, user) // access check
    return { topic, course }
  }

  // Attach the source passages (with document names) that a lesson cites
  private async withSources<T extends { sourceChunkIds: string[]; content: unknown }>(lesson: T) {
    const chunks = lesson.sourceChunkIds.length
      ? await this.prisma.documentChunk.findMany({
          where: { id: { in: lesson.sourceChunkIds } },
          select: { id: true, text: true, document: { select: { fileName: true } } },
        })
      : []
    const byId = new Map(chunks.map(c => [c.id, c]))
    return {
      ...lesson,
      content: await this.visuals.forRead(lesson.content as Record<string, unknown>),
      // Index i corresponds to citation marker S{i+1}; passages deleted since generation show as unavailable
      sources: lesson.sourceChunkIds.map((id, i) => ({
        marker: `S${i + 1}`,
        documentName: byId.get(id)?.document.fileName ?? 'Removed document',
        excerpt: byId.get(id)?.text ?? null,
      })),
    }
  }

  async getCurrent(topicId: string, user: AuthUser) {
    const { topic, course } = await this.loadTopic(topicId, user)
    const versions = await this.prisma.topicLesson.findMany({
      where: { topicId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, mode: true, createdAt: true },
    })
    const latest = versions[0] ? await this.prisma.topicLesson.findUniqueOrThrow({ where: { id: versions[0].id } }) : null
    return {
      topic: {
        id: topic.id,
        name: topic.name,
        parentTopicId: topic.parentTopicId,
        courseId: course.id,
        courseTitle: course.title,
        subtopics: topic.subTopics.map(s => s.name),
      },
      hasMaterial: await this.retrieval.courseHasMaterial(course.id),
      versions,
      lesson: latest ? await this.withSources(latest) : null,
    }
  }

  async getVersion(lessonId: string, user: AuthUser) {
    const lesson = await this.prisma.topicLesson.findUnique({ where: { id: lessonId } })
    if (!lesson) throw new NotFoundException('Lesson not found')
    await this.loadTopic(lesson.topicId, user)
    return this.withSources(lesson)
  }

  async generate(topicId: string, dto: GenerateLessonDto, user: AuthUser) {
    const { topic, course } = await this.loadTopic(topicId, user)
    const requested = dto.mode ?? 'COMBINED'

    let excerpts: LessonExcerpt[] = []
    let chunkIds: string[] = []
    if (requested !== 'AI') {
      const query = [topic.name, topic.description, ...topic.subTopics.map(s => s.name)].filter(Boolean).join('. ')
      const chunks = await this.retrieval.retrieve(course.id, query, user, {
        k: 8,
        topicIds: [topic.id, ...topic.subTopics.map(s => s.id)],
      })
      chunkIds = chunks.map(c => c.id)
      excerpts = chunks.map((c, i) => ({ id: `S${i + 1}`, source: c.documentName, text: c.text }))
    }
    if (requested === 'MATERIAL' && excerpts.length === 0) {
      throw new BadRequestException(
        "We couldn't find anything about this topic in your uploaded material. Upload notes that cover it, or use AI mode.",
      )
    }
    // Combined with nothing relevant uploaded is effectively AI-only — record what actually happened
    const mode = requested === 'COMBINED' && excerpts.length === 0 ? 'AI' : requested

    let content: LessonContent
    try {
      const raw = await this.ai.generateLesson(
        describeCourse(course),
        { name: topic.name, description: topic.description, subtopics: topic.subTopics.map(s => s.name) },
        excerpts,
        {
          userId: user.id,
          organizationId: user.organizationId ?? undefined,
          relatedEntityId: topic.id,
          mode,
          feedback: dto.feedback,
          visualsEnabled: this.visuals.canGenerate(user.id),
        },
      )
      content = sanitizeLesson(raw, new Set(excerpts.map(e => e.id)))
    } catch (err) {
      this.logger.warn(`Lesson generation failed for topic ${topicId}: ${err instanceof Error ? err.message : String(err)}`)
      throw new BadRequestException("Couldn't write this lesson right now — try again in a moment")
    }
    if (content.sections.length === 0) {
      throw new BadRequestException("The lesson came back empty — try again in a moment")
    }

    content.visuals = await this.visuals.create(content, {
      userId: user.id, organizationId: user.organizationId ?? undefined, relatedEntityId: topic.id,
    })
    delete content.visualPlans

    let persisted = false
    try {
      const last = await this.prisma.topicLesson.findFirst({ where: { topicId }, orderBy: { version: 'desc' } })
      const lesson = await this.prisma.topicLesson.create({
        data: {
          topicId,
          version: (last?.version ?? 0) + 1,
          mode,
          content: content as object,
          sourceChunkIds: chunkIds,
          sourceDocumentIds: [...new Set((await this.prisma.documentChunk.findMany({
            where: { id: { in: chunkIds } },
            select: { documentId: true },
          })).map(c => c.documentId))],
          feedback: dto.feedback ?? null,
          createdById: user.id,
        },
      })
      persisted = true
      return this.withSources(lesson)
    } catch (err) {
      if (!persisted) await this.visuals.discard(content.visuals ?? [])
      throw err
    }
  }

  async report(lessonId: string, reason: string, user: AuthUser) {
    const lesson = await this.prisma.topicLesson.findUnique({ where: { id: lessonId } })
    if (!lesson) throw new NotFoundException('Lesson not found')
    await this.loadTopic(lesson.topicId, user)
    await this.prisma.contentReport.create({ data: { lessonId, userId: user.id, reason } })
    return { message: 'Thanks — reported. You can regenerate the lesson with this feedback.' }
  }
}
