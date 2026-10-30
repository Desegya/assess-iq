import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { LessonsService } from './lessons.service'

describe('readable lesson references', () => {
  it('attaches the original document id to authorized references and handles removed sources', async () => {
    const prisma = {
      topicLesson: {
        findUnique: vi.fn(async () => ({
          topicId: 'topic',
          content: {},
          sourceChunkIds: ['chunk', 'removed'],
        })),
      },
      topic: { findUnique: vi.fn(async () => ({ courseId: 'course' })) },
      documentChunk: {
        findMany: vi.fn(async () => [
          {
            id: 'chunk',
            documentId: 'document',
            text: 'Original passage',
            document: { fileName: 'My notes.pdf' },
          },
        ]),
      },
    }
    const courses = { findOne: vi.fn(async () => ({})) }
    const visuals = { forRead: vi.fn(async () => ({})) }
    const service = new LessonsService(
      prisma as never,
      {} as never,
      courses as never,
      {} as never,
      visuals as never,
    )
    const lesson = await service.getVersion('lesson', { id: 'reader' } as never)
    expect(lesson.sources).toEqual([
      {
        marker: 'S1',
        documentId: 'document',
        documentName: 'My notes.pdf',
        excerpt: 'Original passage',
      },
      { marker: 'S2', documentId: null, documentName: 'Removed document', excerpt: null },
    ])
    expect(courses.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.documentChunk.findMany.mock.invocationCallOrder[0]!,
    )
  })
})
