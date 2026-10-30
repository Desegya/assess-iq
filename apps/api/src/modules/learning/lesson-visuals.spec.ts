import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import type { LessonVisualPlan } from '@assessiq/types'
import { sanitizeVisualPlans, canGenerateLessonVisuals } from './lesson-visuals'
import { LessonVisualsService } from './lesson-visuals.service'
import { illustrationCost } from './lesson-illustrations.service'
import { LessonsService } from './lessons.service'

const process: LessonVisualPlan = {
  kind: 'process',
  sectionIndex: 0,
  title: 'Find the frequency',
  caption: 'Use $f=1/T$.',
  alt: 'Convert the period into frequency.',
  imagePrompt: '',
  steps: [
    { label: 'Period', detail: 'Measure $T$.' },
    { label: 'Frequency', detail: 'Calculate $f=1/T$.' },
  ],
}
const illustration: LessonVisualPlan = {
  ...process,
  kind: 'illustration',
  title: 'A vibrating string',
  steps: [],
  imagePrompt: 'A string vibrating between two fixed ends.',
}
const content = {
  objectives: [],
  introduction: 'Waves',
  sections: [{ heading: 'Frequency', body: 'Frequency is the reciprocal of period.' }],
  keyTerms: [],
  workedExamples: [],
  applications: [],
  diagramIdeas: [],
  summary: [],
  examQuestions: [],
  visualPlans: [process, illustration],
}
const context = { userId: 'learner', relatedEntityId: 'topic' }

function setup(access = 'all') {
  const config = {
    get: vi.fn((key: string, fallback?: string) =>
      key === 'LESSON_VISUALS_ACCESS' ? access : fallback,
    ),
  }
  const images = {
    isConfigured: vi.fn(() => true),
    generate: vi.fn(async () => Buffer.from('image')),
  }
  const ai = { reviewLessonIllustration: vi.fn(async () => true) }
  const storage = {
    uploadBuffer: vi.fn(async () => {}),
    getSignedDownloadUrl: vi.fn(async () => 'https://storage.test/signed'),
    delete: vi.fn(async () => {}),
  }
  const service = new LessonVisualsService(
    config as never,
    images as never,
    ai as never,
    storage as never,
  )
  return { service, images, ai, storage }
}

describe('lesson visuals', () => {
  it('bounds model output and rejects invalid references, incomplete processes and extra illustrations', () => {
    const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    expect(
      sanitizeVisualPlans(
        [
          null,
          { ...process, sectionIndex: 2 },
          { ...process, steps: [] },
          illustration,
          illustration,
          process,
          process,
        ],
        1,
        clean,
      ),
    ).toEqual([illustration, process])
    expect(
      sanitizeVisualPlans(
        [
          {
            ...illustration,
            storageKey: 'forged',
            url: 'https://evil.test',
            title: 'x'.repeat(200),
          },
        ],
        1,
        clean,
      )[0],
    ).toEqual({ ...illustration, title: 'x'.repeat(160) })
  })

  it('gates generation on the server and denies unknown access modes', async () => {
    expect(canGenerateLessonVisuals('all', 'user', '')).toBe(true)
    expect(canGenerateLessonVisuals('allowlist', 'user', 'other, user ')).toBe(true)
    expect(canGenerateLessonVisuals('allowlist', 'user', 'other')).toBe(false)
    expect(canGenerateLessonVisuals('premium', 'user', 'user')).toBe(false)
    const { service, images, storage } = setup('off')
    expect(await service.create(content, context)).toEqual([])
    expect(images.generate).not.toHaveBeenCalled()
    expect(storage.uploadBuffer).not.toHaveBeenCalled()
  })

  it('stores approved illustrations privately and never stores a prompt or a temporary URL', async () => {
    const { service, storage, ai } = setup()
    const visuals = await service.create(content, context)
    expect(visuals).toHaveLength(2)
    expect(visuals[0]?.steps[1]?.detail).toBe('Calculate $f=1/T$.')
    expect(visuals[1]?.storageKey).toMatch(/^lesson-visuals\/topic\/.+\.png$/)
    expect(visuals[1]).not.toHaveProperty('imagePrompt')
    expect(visuals[1]).not.toHaveProperty('url')
    expect(ai.reviewLessonIllustration).toHaveBeenCalledOnce()
    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      visuals[1]?.storageKey,
      expect.any(Buffer),
      'image/png',
    )
    const read = await service.forRead({ ...content, visuals })
    expect(read).not.toHaveProperty('visualPlans')
    expect(read.visuals?.[1]).toMatchObject({ url: 'https://storage.test/signed' })
    expect(read.visuals?.[1]).not.toHaveProperty('storageKey')
  })

  it('keeps the process diagram when image generation fails or an image is rejected', async () => {
    const { service, images, ai, storage } = setup()
    images.generate.mockRejectedValueOnce(new Error('provider timeout'))
    expect(await service.create(content, context)).toHaveLength(1)
    ai.reviewLessonIllustration.mockResolvedValueOnce(false)
    expect(await service.create(content, context)).toHaveLength(1)
    expect(storage.uploadBuffer).not.toHaveBeenCalled()
  })

  it('supports old lessons and signing failures without regenerating an image', async () => {
    const { service, images, storage } = setup()
    expect(await service.forRead({ introduction: 'Old notes' })).toEqual({
      introduction: 'Old notes',
    })
    storage.getSignedDownloadUrl.mockRejectedValueOnce(new Error('storage unavailable'))
    const read = await service.forRead({
      visuals: [{ ...illustration, storageKey: 'lesson-visuals/topic/test.png' }],
    })
    expect(read.visuals?.[0]).not.toHaveProperty('url')
    expect(images.generate).not.toHaveBeenCalled()
  })

  it('does not sign stored media until the lesson access check succeeds', async () => {
    const { service, storage } = setup()
    const prisma = {
      topicLesson: {
        findUnique: vi.fn(async () => ({
          topicId: 'private-topic',
          content: {},
          sourceChunkIds: [],
        })),
      },
      topic: { findUnique: vi.fn(async () => ({ courseId: 'private-course' })) },
    }
    const courses = {
      findOne: vi.fn(async () => {
        throw new Error('Forbidden')
      }),
    }
    const lessons = new LessonsService(
      prisma as never,
      {} as never,
      courses as never,
      {} as never,
      service,
    )
    await expect(lessons.getVersion('private-lesson', { id: 'outsider' } as never)).rejects.toThrow(
      'Forbidden',
    )
    expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('accounts separately for text input, image input and image output tokens', () => {
    expect(
      illustrationCost({
        input_tokens_details: { text_tokens: 1000, image_tokens: 0 },
        output_tokens: 2000,
      }),
    ).toBeCloseTo(0.065)
  })
})
