import { expect, it, vi } from 'vitest'
import { loadPlanTopics } from './plan-topics'

it('includes subtopic quiz performance, confidence and completed effort in the scheduled topic', async () => {
  const database = {
    topic: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'parent', name: 'Cells', estimatedMinutes: 60, subTopics: [{ id: 'child' }] },
        ]),
    },
    topicMastery: { findMany: vi.fn().mockResolvedValue([{ topicId: 'child', quizAverage: 25 }]) },
    studySession: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            topicId: 'child',
            kind: 'LEARN',
            actualMinutes: 30,
            estimatedMinutes: 45,
            confidenceRating: 2,
          },
        ]),
    },
  }
  const topics = await loadPlanTopics(database as never, 'biology', { id: 'student' } as never)
  expect(topics[0]).toMatchObject({
    id: 'parent',
    mastery: 25,
    confidence: 2,
    completedMinutes: 30,
  })
  expect(database.topicMastery.findMany.mock.calls[0]![0].where.topicId.in).toEqual([
    'parent',
    'child',
  ])
})
