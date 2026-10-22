import { shuffleOptions } from './exam-sampling'

export interface FrozenMockQuestion {
  id: string; subjectKey: string; subject: string; topic: string; questionText: string
  options: { key: string; text: string }[]; correctAnswer: string; explanation: string; bankRevision: number
  /** Authored option keys in displayed order when options were shuffled at freeze time. */
  optionOrder?: string[]
}

/** Snapshot of a published bank question as shown in one attempt, with MCQ options shuffled when safe. */
export function freezeQuestion(
  q: { id: string; subjectKey: string; subject: string; topic: string; questionText: string; options: unknown; correctAnswer: string; explanation: string; revision: number },
  random: () => number = Math.random,
): FrozenMockQuestion {
  const options = (q.options ?? []) as FrozenMockQuestion['options']
  const shuffled = shuffleOptions(options, q.correctAnswer, random)
  return {
    id: q.id, subjectKey: q.subjectKey, subject: q.subject, topic: q.topic, questionText: q.questionText,
    options: shuffled?.options ?? options,
    correctAnswer: shuffled?.correctAnswer ?? q.correctAnswer,
    explanation: q.explanation, bankRevision: q.revision,
    ...(shuffled ? { optionOrder: shuffled.optionOrder } : {}),
  }
}
export function markMock(questions: FrozenMockQuestion[], answers: Record<string, string>) {
  const keys = [...new Set(questions.map(q => q.subjectKey))]
  const subjects = keys.map(key => {
    const items = questions.filter(q => q.subjectKey === key)
    const correct = items.filter(q => answers[q.id] === q.correctAnswer).length
    return { subjectKey: key, subject: items[0]!.subject, correct, total: items.length,
      unanswered: items.filter(q => !answers[q.id]).length, practiceScore: Math.round(correct / items.length * 100),
      topics: [...new Set(items.map(q => q.topic))].map(topic => ({ topic, total: items.filter(q => q.topic === topic).length, correct: items.filter(q => q.topic === topic && answers[q.id] === q.correctAnswer).length })) }
  })
  return { subjects, practiceScore: subjects.reduce((sum, s) => sum + s.practiceScore, 0),
    scoringNote: 'Practice estimate: each subject is scaled linearly to 100. This is not an official JAMB result or scoring algorithm.' }
}
