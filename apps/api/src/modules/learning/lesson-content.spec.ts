import { describe, expect, it } from 'vitest'
import type { LessonContent } from '../ai/ai.service'
import { sanitizeLesson } from './lesson-content'

const base: LessonContent = {
  objectives: ['Compute variance [S1]'],
  introduction: 'Spread matters [S1].',
  sections: [{ heading: 'Variance', body: 'Divide by n − 1 [S2]. Some textbooks say otherwise [S9].' }],
  keyTerms: [{ term: 'Variance', definition: 'Mean squared deviation [S3]' }],
  workedExamples: [{ title: 'Example', problem: 'Find s² for 4, 6, 8', steps: ['Mean is 6 [S2]'], answer: '4' }],
  applications: ['Comparing leaf lengths'],
  diagramIdeas: [],
  summary: ['Variance uses n − 1 [S2]'],
  examQuestions: [{ question: 'Why n − 1?', type: 'essay' }],
}

describe('sanitizeLesson', () => {
  it('keeps citations to supplied excerpts and strips invented ones', () => {
    const clean = sanitizeLesson(base, new Set(['S1', 'S2']))
    expect(clean.sections[0]!.body).toBe('Divide by n − 1 [S2]. Some textbooks say otherwise .')
    expect(clean.keyTerms[0]!.definition).toBe('Mean squared deviation')
    expect(clean.objectives[0]).toBe('Compute variance [S1]')
    expect(clean.workedExamples[0]!.steps[0]).toBe('Mean is 6 [S2]')
  })

  it('strips every citation from AI-only lessons', () => {
    const clean = sanitizeLesson(base, new Set())
    expect(JSON.stringify(clean)).not.toMatch(/\[S\d+\]/)
  })

  it('drops malformed entries instead of rendering broken content', () => {
    const raw = {
      ...base,
      sections: [{ heading: 'Ok', body: 'Fine' }, { heading: 'No body' }, null, 'junk'],
      keyTerms: [{ term: 'Only term' }],
      workedExamples: [{ title: 'No problem field' }],
      applications: ['ok', 42, '', '  '],
    } as unknown as LessonContent
    const clean = sanitizeLesson(raw, new Set())

    expect(clean.sections).toEqual([{ heading: 'Ok', body: 'Fine' }])
    expect(clean.keyTerms).toEqual([])
    expect(clean.workedExamples).toEqual([])
    expect(clean.applications).toEqual(['ok'])
  })

  it('defaults unknown exam question types to short answer', () => {
    const raw = { ...base, examQuestions: [{ question: 'Q', type: 'oral' }, { question: '' }] } as unknown as LessonContent
    expect(sanitizeLesson(raw, new Set()).examQuestions).toEqual([{ question: 'Q', type: 'short' }])
  })

  it('survives missing arrays entirely', () => {
    const clean = sanitizeLesson({ introduction: 'Hi' } as unknown as LessonContent, new Set())
    expect(clean.sections).toEqual([])
    expect(clean.introduction).toBe('Hi')
  })
})
