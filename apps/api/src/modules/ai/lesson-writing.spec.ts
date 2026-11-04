import { describe, expect, it, vi } from 'vitest'
import { AiService } from './ai.service'

function setup() {
  const lesson = {
    objectives: ['Distinguish confidentiality from privacy'],
    introduction: 'Confidentiality protects information [S1].',
    sections: [
      {
        heading: 'Confidentiality',
        body: 'Data confidentiality prevents unauthorized disclosure [S1]. Privacy concerns control over personal information.',
      },
    ],
    keyTerms: [],
    workedExamples: [],
    applications: [],
    diagramIdeas: [],
    visualPlans: [],
    summary: [],
    examQuestions: [],
  }
  const provider = {
    name: 'fixture',
    isConfigured: () => true,
    estimateCostUsd: () => 0.01,
    complete: vi
      .fn()
      .mockResolvedValue({
        text: JSON.stringify(lesson),
        model: 'fixture',
        inputTokens: 20,
        outputTokens: 50,
        costUsd: 0,
      }),
    embed: vi.fn(),
  }
  const service = new AiService(
    { reserve: vi.fn().mockResolvedValue('reservation'), settle: vi.fn() } as never,
    provider,
  )
  return { service, provider, lesson }
}
const topic = { name: 'Computer security', subtopics: ['Confidentiality'] }
const excerpts = [
  {
    id: 'S1',
    source: 'Lecture notes.pdf',
    text: 'Data confidentiality prevents unauthorized disclosure.',
  },
]

describe('lesson writing', () => {
  it('requests a comprehensive integrated explanation with citations instead of source narration', async () => {
    const { service, provider, lesson } = setup()
    expect(
      await service.generateLesson('University computer security', topic, excerpts, {
        mode: 'COMBINED',
        userId: 'student',
      }),
    ).toEqual(lesson)
    const request = provider.complete.mock.calls[0]![0]
    expect(request.input).toContain('one comprehensive, integrated lesson')
    expect(request.input).toContain('do not interrupt the lesson to announce a gap')
    expect(request.input).toContain('Source attribution belongs in inline citation markers')
    expect(request.input).toContain('mechanisms or reasoning')
    expect(request.input).toContain('conceptual topics, use realistic scenarios')
    expect(request.input).toContain('ONLY to claims supported by that excerpt')
    expect(request.input).toContain('[S1] (Lecture notes.pdf)')
    expect(request.maxOutputTokens).toBe(16000)
    expect(request.jsonSchema.name).toBe('lesson')
    expect(lesson.sections[0]!.body).toContain('[S1]')
  })

  it('keeps material-only lessons source-bound without narrating unsupported gaps', async () => {
    const { service, provider } = setup()
    await service.generateLesson('Computer security', topic, excerpts, {
      mode: 'MATERIAL',
      userId: 'student',
    })
    const request = provider.complete.mock.calls[0]![0]
    expect(request.input).toContain('Use ONLY the numbered excerpts')
    expect(request.input).toContain('without adding outside knowledge')
    expect(request.input).toContain('Omit unsupported material without narrating')
    expect(request.input).toContain('return fewer examples if necessary')
  })

  it('keeps AI-only lessons citation-free and preserves regeneration feedback', async () => {
    const { service, provider } = setup()
    await service.generateLesson('Computer security', topic, [], {
      mode: 'AI',
      userId: 'student',
      feedback: 'Explain the mechanisms in more depth.',
    })
    const request = provider.complete.mock.calls[0]![0]
    expect(request.input).toContain('Do not include any citation markers')
    expect(request.input).toContain('Explain the mechanisms in more depth.')
    expect(request.input).not.toContain('EXCERPTS FROM THE STUDENT')
  })
})
