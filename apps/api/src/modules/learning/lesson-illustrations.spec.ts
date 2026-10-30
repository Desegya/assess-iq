import 'reflect-metadata'
import { describe, expect, it, vi, beforeEach } from 'vitest'
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('openai', () => ({
  default: class {
    images = { generate }
  },
}))
import { LessonIllustrationsService } from './lesson-illustrations.service'

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
function setup(enabled = 'true') {
  const config = {
    get: (key: string, fallback: string) =>
      key === 'OPENAI_API_KEY'
        ? 'test-key'
        : key === 'LESSON_ILLUSTRATIONS_ENABLED'
          ? enabled
          : fallback,
  }
  const quota = { reserve: vi.fn(async () => 'reservation'), settle: vi.fn(async () => {}) }
  return { service: new LessonIllustrationsService(config as never, quota as never), quota }
}
const context = { userId: 'learner', relatedEntityId: 'topic' }
beforeEach(() => generate.mockReset())

describe('lesson illustration provider', () => {
  it('reserves before calling the paid provider and settles reported usage', async () => {
    const { service, quota } = setup()
    generate.mockResolvedValue({
      data: [{ b64_json: png.toString('base64') }],
      usage: {
        input_tokens: 100,
        input_tokens_details: { text_tokens: 100, image_tokens: 0 },
        output_tokens: 1000,
      },
    })
    expect(await service.generate('A wave', context)).toEqual(png)
    expect(quota.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      generate.mock.invocationCallOrder[0]!,
    )
    expect(quota.settle).toHaveBeenCalledWith(
      'reservation',
      expect.objectContaining({ costUsd: 0.0305, inputTokens: 100, outputTokens: 1000 }),
    )
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ n: 1, output_format: 'png', quality: 'medium' }),
    )
  })

  it('never calls the provider when access or budget is unavailable', async () => {
    await expect(setup('false').service.generate('Wave', context)).rejects.toThrow('disabled')
    const { service, quota } = setup()
    quota.reserve.mockRejectedValueOnce(new Error('Quota exceeded'))
    await expect(service.generate('Wave', context)).rejects.toThrow('Quota exceeded')
    expect(generate).not.toHaveBeenCalled()
  })

  it('retains a conservative budget charge on an ambiguous timeout', async () => {
    const { service, quota } = setup()
    generate.mockRejectedValueOnce(new Error('Timeout'))
    await expect(service.generate('Wave', context)).rejects.toThrow('Timeout')
    expect(quota.settle).toHaveBeenCalledWith(
      'reservation',
      expect.objectContaining({ costUsd: 0.25, errorMessage: 'Timeout' }),
    )
  })

  it('rejects non-PNG responses without losing usage accounting', async () => {
    const { service, quota } = setup()
    generate.mockResolvedValue({
      data: [{ b64_json: Buffer.from('<svg>untrusted</svg>').toString('base64') }],
    })
    await expect(service.generate('Wave', context)).rejects.toThrow('not PNG')
    expect(quota.settle).toHaveBeenCalledOnce()
  })
})
