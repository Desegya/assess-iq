import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import { AiService } from '../ai/ai.service'

describe('PDF timetable AI extraction contract', () => {
  function setup(text: string) {
    const create = vi.fn().mockResolvedValue(undefined)
    const quota = { reserve: vi.fn().mockResolvedValue('reservation-1'), settle: create }
    const provider = {
      name: 'fixture',
      isConfigured: () => true,
      estimateCostUsd: () => 0.01,
      complete: vi
        .fn()
        .mockResolvedValue({
          text,
          model: 'fixture',
          inputTokens: 10,
          outputTokens: 20,
          costUsd: 0,
        }),
      embed: vi.fn(),
    }
    const service = new AiService(quota as any, provider)
    return { service, provider, create }
  }
  it('requests structured source-based dates and records usage', async () => {
    const data = {
      entries: [
        {
          subject: 'Government',
          paperCode: 'GOV2',
          title: 'Essay',
          date: '2027-05-20',
          startTime: '09:00',
          endTime: '11:00',
          notes: '',
        },
      ],
      warnings: [],
    }
    const { service, provider, create } = setup(JSON.stringify(data))
    expect(
      await service.extractExamTimetable(
        'Thursday 20 May 2027 Government Essay 09:00–11:00',
        2027,
        { userId: 'teacher', relatedEntityId: 'calendar' },
      ),
    ).toEqual(data)
    expect(provider.complete.mock.calls[0][0].jsonSchema.name).toBe('waec_timetable')
    expect(provider.complete.mock.calls[0][0].input).toContain('never invent dates')
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0][0]).toBe('reservation-1')
    expect(create.mock.calls[0][1]).toMatchObject({ model: 'fixture', inputTokens: 10, outputTokens: 20 })
  })
  it('rejects malformed structured output', async () => {
    const { service } = setup('{"entries": "not rows", "warnings": []}')
    await expect(
      service.extractExamTimetable('source', 2027, {
        userId: 'teacher',
        relatedEntityId: 'calendar',
      }),
    ).rejects.toThrow('invalid data')
  })
})
