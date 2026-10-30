import type { LessonContent } from '../ai/ai.service'
import { sanitizeVisualPlans } from './lesson-visuals'

const CITATION = /\[(S\d+)\]/g

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : []
}

// Keep only well-formed fields, and strip citation markers that don't match a supplied excerpt
export function sanitizeLesson(raw: LessonContent, allowedIds: Set<string>): LessonContent {
  const clean = (text: unknown) =>
    typeof text === 'string' ? text.replace(CITATION, (m, id: string) => (allowedIds.has(id) ? m : '')).trim() : ''
  const list = <T>(value: unknown, map: (item: Record<string, unknown>) => T | null): T[] =>
    Array.isArray(value) ? value.map(v => (v && typeof v === 'object' ? map(v as Record<string, unknown>) : null)).filter((v): v is T => !!v) : []

  const sections = list(raw.sections, s => (s.heading && s.body ? { heading: clean(s.heading), body: clean(s.body) } : null))
  return {
    objectives: strings(raw.objectives).map(clean),
    introduction: clean(raw.introduction),
    sections,
    keyTerms: list(raw.keyTerms, k => (k.term && k.definition ? { term: clean(k.term), definition: clean(k.definition) } : null)),
    workedExamples: list(raw.workedExamples, w =>
      w.title && w.problem
        ? { title: clean(w.title), problem: clean(w.problem), steps: strings(w.steps).map(clean), answer: clean(w.answer) }
        : null,
    ),
    applications: strings(raw.applications).map(clean),
    diagramIdeas: strings(raw.diagramIdeas).map(clean),
    visualPlans: sanitizeVisualPlans(Array.isArray(raw.sections) && sections.length === raw.sections.length ? raw.visualPlans : [], sections.length, clean),
    summary: strings(raw.summary).map(clean),
    examQuestions: list(raw.examQuestions, q =>
      q.question
        ? {
            question: clean(q.question),
            type: (['short', 'structured', 'essay', 'calculation'] as const).includes(q.type as 'short')
              ? (q.type as LessonContent['examQuestions'][number]['type'])
              : 'short',
          }
        : null,
    ),
  }
}
