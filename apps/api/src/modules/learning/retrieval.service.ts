import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import { CoursesService } from '../courses/courses.service'
import { AuthUser } from '@assessiq/types'
import { chunkText, cosine, keywordScore } from './chunk-text'

const EMBED_BATCH = 64
// text-embedding-3-small similarities measured on course notes: off-topic passages from the same course score up to
// ~0.32, on-topic ones 0.35-0.7. Keep passages above the floor and within a window of the best match.
const MIN_SIMILARITY = 0.33
const RELATIVE_WINDOW = 0.25
const TOPIC_MATCH_SIMILARITY = 0.35

export interface RetrievedChunk {
  id: string
  documentId: string
  documentName: string
  text: string
  score: number
}

type AiOpts = { userId: string; organizationId?: string; relatedEntityId: string }

function aiOpts(user: AuthUser, relatedEntityId: string): AiOpts {
  return { userId: user.id, organizationId: user.organizationId ?? undefined, relatedEntityId }
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly coursesService: CoursesService,
  ) {}

  // ─── Indexing ─────────────────────────────────────────────────────────────

  // Splits a course document into passages and embeds them. Passages are stored even if embedding fails,
  // so keyword retrieval still works without AI.
  async indexDocument(doc: { id: string; courseId: string | null; extractedText: string | null }, user: AuthUser) {
    if (!doc.courseId || !doc.extractedText?.trim()) return 0
    const passages = chunkText(doc.extractedText)
    if (passages.length === 0) return 0

    const vectors: number[][] = []
    try {
      for (let i = 0; i < passages.length; i += EMBED_BATCH) {
        vectors.push(...(await this.ai.embed(passages.slice(i, i + EMBED_BATCH), aiOpts(user, doc.id))))
      }
    } catch (err) {
      this.logger.warn(`Embedding failed for document ${doc.id}, storing passages without vectors: ${String(err)}`)
      vectors.length = 0
    }

    await this.prisma.$transaction([
      this.prisma.documentChunk.deleteMany({ where: { documentId: doc.id } }),
      this.prisma.documentChunk.createMany({
        data: passages.map((text, index) => ({
          documentId: doc.id,
          courseId: doc.courseId!,
          index,
          text,
          embedding: vectors[index] ?? [],
        })),
      }),
    ])
    this.logger.log(`Indexed document ${doc.id}: ${passages.length} passages${vectors.length ? ' with embeddings' : ''}`)
    return passages.length
  }

  // Documents uploaded before retrieval existed get indexed the first time they're needed
  private async ensureCourseIndexed(courseId: string, user: AuthUser) {
    const unindexed = await this.prisma.document.findMany({
      where: { courseId, status: 'READY', extractedText: { not: null }, chunks: { none: {} } },
      select: { id: true, courseId: true, extractedText: true },
    })
    for (const doc of unindexed) await this.indexDocument(doc, user)
  }

  async courseHasMaterial(courseId: string) {
    const count = await this.prisma.document.count({ where: { courseId, status: 'READY', extractedText: { not: null } } })
    return count > 0
  }

  // ─── Retrieval ────────────────────────────────────────────────────────────

  async retrieve(
    courseId: string,
    query: string,
    user: AuthUser,
    options: { k?: number; topicIds?: string[] } = {},
  ): Promise<RetrievedChunk[]> {
    const k = options.k ?? 6
    await this.ensureCourseIndexed(courseId, user)

    const chunks = await this.prisma.documentChunk.findMany({
      where: { courseId },
      select: { id: true, documentId: true, text: true, embedding: true, topicId: true, document: { select: { fileName: true } } },
    })
    if (chunks.length === 0) return []

    let queryVector: number[] | null = null
    if (chunks.some(c => c.embedding.length > 0)) {
      try {
        queryVector = (await this.ai.embed([query], aiOpts(user, courseId)))[0] ?? null
      } catch (err) {
        this.logger.warn(`Query embedding failed, falling back to keyword retrieval: ${String(err)}`)
      }
    }

    const boostTopics = new Set(options.topicIds ?? [])
    const scored = chunks
      .map(c => {
        const semantic = queryVector && c.embedding.length ? cosine(queryVector, c.embedding) : null
        const base = semantic ?? keywordScore(query, c.text) * 0.6
        const relevant = semantic !== null ? semantic >= MIN_SIMILARITY : base > 0
        // Passages already mapped to the topic being studied get a small boost
        return { c, score: base + (c.topicId && boostTopics.has(c.topicId) ? 0.08 : 0), relevant }
      })
      .filter(x => x.relevant)
      .sort((a, b) => b.score - a.score)
    const best = scored[0]?.score ?? 0
    const top = scored.filter(x => x.score >= best - RELATIVE_WINDOW).slice(0, k)

    return top.map(({ c, score }) => ({
      id: c.id,
      documentId: c.documentId,
      documentName: c.document.fileName,
      text: c.text,
      score: Math.round(score * 1000) / 1000,
    }))
  }

  // ─── Map an uploaded document onto the course outline ─────────────────────

  async mapDocument(documentId: string, user: AuthUser) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc?.courseId) throw new NotFoundException('Document not found')
    await this.coursesService.findOne(doc.courseId, user) // access check

    if ((await this.prisma.documentChunk.count({ where: { documentId } })) === 0) await this.indexDocument(doc, user)
    const chunks = await this.prisma.documentChunk.findMany({ where: { documentId } })
    const topics = await this.prisma.topic.findMany({
      where: { courseId: doc.courseId, archivedAt: null },
      orderBy: { order: 'asc' },
    })

    // 1. Link each passage to its closest topic (subtopic matches count toward their parent)
    const coverage = new Map<string, number>()
    if (topics.length && chunks.some(c => c.embedding.length)) {
      try {
        const topicVectors = await this.ai.embed(
          topics.map(t => `${t.name}${t.description ? `: ${t.description}` : ''}`),
          aiOpts(user, documentId),
        )
        const updates = []
        for (const chunk of chunks) {
          if (!chunk.embedding.length) continue
          let best = { index: -1, score: 0 }
          topicVectors.forEach((v, i) => {
            const score = cosine(chunk.embedding, v)
            if (score > best.score) best = { index: i, score }
          })
          const topic = best.score >= TOPIC_MATCH_SIMILARITY ? topics[best.index]! : null
          updates.push(this.prisma.documentChunk.update({ where: { id: chunk.id }, data: { topicId: topic?.id ?? null } }))
          if (topic) {
            const key = topic.parentTopicId ?? topic.id
            coverage.set(key, (coverage.get(key) ?? 0) + 1)
          }
        }
        await this.prisma.$transaction(updates)
      } catch (err) {
        this.logger.warn(`Topic mapping failed for document ${documentId}: ${String(err)}`)
      }
    }

    // 2. Ask AI for substantial concepts the outline is missing
    let newTopics: { name: string; description?: string }[] = []
    try {
      newTopics = await this.ai.findUncoveredTopics(
        topics.map(t => t.name),
        doc.extractedText ?? '',
        aiOpts(user, documentId),
      )
    } catch (err) {
      this.logger.warn(`New-concept detection failed for document ${documentId}: ${String(err)}`)
    }

    const byId = new Map(topics.map(t => [t.id, t]))
    return {
      documentId,
      fileName: doc.fileName,
      covered: [...coverage.entries()]
        .map(([topicId, passages]) => ({ topicId, name: byId.get(topicId)?.name ?? '', passages }))
        .sort((a, b) => b.passages - a.passages),
      newTopics: newTopics.filter(t => t?.name).slice(0, 5),
    }
  }
}
