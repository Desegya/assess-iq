import { describe, expect, it, vi } from 'vitest'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { StudyService } from './study.service'
import { ChatDto } from './dto/chat.dto'

const user = { id: 'learner', organizationId: null } as never
function setup() {
  const db = {
    topic: { findFirst: vi.fn().mockResolvedValue({ id: 'waves', name: 'Frequency' }) },
    topicLesson: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          mode: 'AI',
          content: { introduction: 'Frequency equals one divided by period.' },
          topic: { name: 'Frequency' },
        }),
    },
    document: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          fileName: 'Lecture notes',
          extractedText: 'Frequency is measured in hertz.',
        }),
    },
  }
  const ai = { chat: vi.fn().mockResolvedValue('A shorter period means more cycles each second.') }
  const courses = {
    findOne: vi
      .fn()
      .mockResolvedValue({ title: 'Physics', subject: 'Physics', topics: [{ name: 'Frequency' }] }),
  }
  const retrieval = { retrieve: vi.fn().mockResolvedValue([]) }
  return {
    db,
    ai,
    courses,
    retrieval,
    service: new StudyService(
      db as never,
      {} as never,
      courses as never,
      ai as never,
      {} as never,
      retrieval as never,
    ),
  }
}

describe('questions in the study screen', () => {
  it('uses the current stored lesson, topic, selected passage and follow-up history', async () => {
    const { service, ai, retrieval } = setup()
    const result = await service.chat(
      'physics',
      {
        message: 'Why does it get larger?',
        topicId: 'waves',
        lessonId: 'lesson',
        selectedText: 'f = 1/T',
        history: [
          { role: 'user', content: 'Explain frequency.' },
          { role: 'assistant', content: 'It counts cycles per second.' },
        ],
      },
      user,
    )
    expect(result.source).toBe('lesson')
    const [messages, context] = ai.chat.mock.calls[0]!
    expect(messages).toHaveLength(3)
    expect(context).toContain('Frequency equals one divided by period.')
    expect(context).toContain('f = 1/T')
    expect(context).toContain('may contain AI mistakes')
    expect(retrieval.retrieve.mock.calls[0]![1]).toContain('Frequency')
  })

  it('rejects a lesson from another course or topic before answering', async () => {
    const { db, service, ai, retrieval } = setup()
    db.topicLesson.findFirst.mockResolvedValue(null)
    await expect(
      service.chat(
        'physics',
        { message: 'Explain this', topicId: 'waves', lessonId: 'foreign-lesson' },
        user,
      ),
    ).rejects.toThrow('Lesson not found')
    expect(db.topicLesson.findFirst.mock.calls[0]![0].where).toMatchObject({
      id: 'foreign-lesson',
      topicId: 'waves',
      topic: { courseId: 'physics' },
    })
    expect(ai.chat).not.toHaveBeenCalled()
    expect(retrieval.retrieve).not.toHaveBeenCalled()
  })

  it('uses only an approved document in the same course and scopes retrieval to it', async () => {
    const { service, db, retrieval } = setup()
    expect(
      (await service.chat('physics', { message: 'What is hertz?', documentId: 'notes' }, user))
        .source,
    ).toBe('ai')
    expect(db.document.findFirst.mock.calls[0]![0].where).toMatchObject({
      id: 'notes',
      courseId: 'physics',
      materialReviewStatus: 'APPROVED',
    })
    expect(retrieval.retrieve.mock.calls[0]![3]).toMatchObject({ documentId: 'notes' })
    db.document.findFirst.mockResolvedValue(null)
    await expect(
      service.chat('physics', { message: 'Explain', documentId: 'held-or-foreign-file' }, user),
    ).rejects.toThrow('not an approved source')
  })

  it('labels general answers and unavailable AI without presenting basic search as an explanation', async () => {
    const { service, ai } = setup()
    expect((await service.chat('physics', { message: 'Explain momentum' }, user)).source).toBe(
      'general',
    )
    ai.chat.mockRejectedValue(new Error('Unavailable'))
    const result = await service.chat(
      'physics',
      { message: 'Explain frequency', lessonId: 'lesson' },
      user,
    )
    expect(result.source).toBe('fallback')
    expect(result.reply).toContain('basic text search')
  })

  it('enforces bounded question, passage and conversation payloads', async () => {
    const valid = plainToInstance(ChatDto, {
      message: 'a'.repeat(2000),
      selectedText: 'b'.repeat(2000),
      history: [{ role: 'user', content: 'c'.repeat(4000) }],
    })
    expect(await validate(valid)).toHaveLength(0)
    valid.selectedText += 'b'
    expect((await validate(valid)).some((error) => error.property === 'selectedText')).toBe(true)
  })
})
