import { describe, expect, it, vi } from 'vitest'
import { DocumentsService } from './documents.service'
import { RetrievalService } from '../learning/retrieval.service'

const user = { id: 'learner', role: 'STUDENT', organizationId: null } as never
function setup(verdict: 'MATCH' | 'MISMATCH' | 'UNCERTAIN' | 'ERROR') {
  const doc = {
    id: 'note',
    uploadedById: 'learner',
    courseId: 'biology',
    fileName: 'notes.txt',
    status: 'READY',
    extractedText: 'Lecture material',
    materialReviewStatus: 'NEEDS_REVIEW',
  }
  const db = {
    course: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ title: 'Biology', subject: 'Biology', topics: [{ name: 'Cells' }] }),
    },
    document: {
      create: vi.fn().mockResolvedValue(doc),
      findFirst: vi.fn().mockResolvedValue(doc),
      update: vi.fn(async ({ data }) => ({ ...doc, ...data })),
    },
  }
  const ai = {
    assessCourseMaterial: vi.fn(async () => {
      if (verdict === 'ERROR') throw new Error('Unavailable')
      return {
        verdict,
        reason:
          verdict === 'MISMATCH'
            ? 'The notes describe accounting ledgers.'
            : 'Evidence from the material.',
      }
    }),
  }
  const retrieval = { indexDocument: vi.fn().mockResolvedValue(1) }
  const service = new DocumentsService(
    db as never,
    { uploadBuffer: vi.fn() } as never,
    ai as never,
    retrieval as never,
  )
  return { db, ai, retrieval, service, doc }
}
const file = {
  originalname: 'notes.txt',
  mimetype: 'text/plain',
  buffer: Buffer.from('Lecture material'),
  size: 16,
} as Express.Multer.File

describe('course material review', () => {
  it.each(['MISMATCH', 'UNCERTAIN', 'ERROR'] as const)(
    'holds %s material without making it a study source',
    async (verdict) => {
      const { db, service, retrieval } = setup(verdict)
      const saved = await service.upload(file, { courseId: 'biology' }, user)
      expect(db.document.create.mock.calls[0]![0].data.materialReviewStatus).toBe('PENDING')
      expect(saved).toMatchObject({ status: 'READY', materialReviewStatus: 'NEEDS_REVIEW' })
      expect(saved.materialReviewReason).toBeTruthy()
      expect(retrieval.indexDocument).not.toHaveBeenCalled()
      if (verdict === 'MISMATCH') expect(saved.materialReviewReason).toContain('different course')
    },
  )

  it('allows clearly relevant material and checks the course context rather than just filenames', async () => {
    const { service, ai, retrieval } = setup('MATCH')
    const saved = await service.upload(file, { courseId: 'biology' }, user)
    expect(saved.materialReviewStatus).toBe('APPROVED')
    expect(ai.assessCourseMaterial).toHaveBeenCalledWith(
      'Biology (Biology)',
      ['Cells'],
      'Lecture material',
      expect.objectContaining({ userId: 'learner' }),
    )
    expect(retrieval.indexDocument).toHaveBeenCalledOnce()
  })

  it('lets the uploader explicitly approve a held file, but blocks another learner', async () => {
    const { service, retrieval } = setup('MISMATCH')
    expect(await service.approveCourseMaterial('note', user)).toMatchObject({
      materialReviewStatus: 'APPROVED',
    })
    expect(retrieval.indexDocument).toHaveBeenCalledOnce()
    await expect(
      service.approveCourseMaterial('note', { id: 'someone-else', role: 'STUDENT' } as never),
    ).rejects.toThrow('Only the uploader')
  })

  it('rejects an inaccessible course before creating or checking a file', async () => {
    const { service, db } = setup('MATCH')
    db.course.findFirst.mockResolvedValue(null)
    await expect(service.upload(file, { courseId: 'not-my-course' }, user)).rejects.toThrow(
      'Course not found',
    )
    expect(db.document.create).not.toHaveBeenCalled()
  })

  it('blocks topic mapping while review is pending and excludes held documents from retrieval', async () => {
    const db = {
      document: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'note',
          courseId: 'biology',
          materialReviewStatus: 'NEEDS_REVIEW',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      documentChunk: { findMany: vi.fn().mockResolvedValue([]) },
    }
    const service = new RetrievalService(db as never, {} as never, { findOne: vi.fn() } as never)
    await expect(service.mapDocument('note', user)).rejects.toThrow('confirm that it belongs')
    expect(db.documentChunk.findMany).not.toHaveBeenCalled()
    expect(await service.retrieve('biology', 'Cells', user)).toEqual([])
    expect(db.document.findMany.mock.calls[0]![0].where.materialReviewStatus).toBe('APPROVED')
    expect(db.documentChunk.findMany.mock.calls[0]![0].where.document.materialReviewStatus).toBe(
      'APPROVED',
    )
  })
})
