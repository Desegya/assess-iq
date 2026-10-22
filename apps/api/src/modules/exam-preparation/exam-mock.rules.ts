export interface FrozenMockQuestion {
  id: string; subjectKey: string; subject: string; topic: string; questionText: string
  options: { key: string; text: string }[]; correctAnswer: string; explanation: string; bankRevision: number
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
