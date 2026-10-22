'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'

interface Goal { id: string; exam: string; year: number; subjects: { subjectKey: string; name: string }[] }
interface Question { id: string; questionText: string; questionType: string; options?: { key: string; text: string }[]; marks: number }
interface Practice { topicId: string; actualCount: number; requestedCount: number; questions: Question[] }
interface Result { scorePercent: number | null; gradingFailed: boolean; attemptId: string | null; results: { questionId: string; score: number | null; maxScore: number; correctAnswer: string; explanation: string; feedback?: string; missingPoints?: string[] }[] }
interface Material { id: string; title: string; topic: string; body: string; sourceNote: string }
function PracticeScreen() {
  const api = useApi()
  const params = useSearchParams()
  const goalId = params.get('goal') ?? ''
  const subjectKey = params.get('subject') ?? ''
  const [goals, setGoals] = useState<Goal[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [practice, setPractice] = useState<Practice | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [count, setCount] = useState(10)
  const [topic, setTopic] = useState(params.get('topic') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let current = true
    setError(''); setLoading(true); setPractice(null); setResult(null)
    Promise.all([
      api.get<Goal[]>('/exam-preparation/goals'),
      api.get<Material[]>(`/exam-preparation/goals/${encodeURIComponent(goalId)}/subjects/${encodeURIComponent(subjectKey)}/materials`),
    ]).then(([g, m]) => { if (current) { setGoals(g); setMaterials(m) } })
      .catch(err => { if (current) setError(err instanceof Error ? err.message : 'Could not load this subject') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [api, goalId, subjectKey])
  const goal = goals.find(g => g.id === goalId)
  const subject = goal?.subjects.find(s => s.subjectKey === subjectKey)
  async function start(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { setPractice(await api.post<Practice>('/exam-preparation/practice', { goalId, subjectKey, count, ...(params.get('objective') ? { objectiveId: params.get('objective') } : {}), ...(topic.trim() ? { topic: topic.trim() } : {}) })); setAnswers({}); setResult(null) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not start practice') }
    finally { setBusy(false) }
  }
  async function submit() {
    if (!practice) return
    setBusy(true); setError('')
    try {
      setResult(await api.post<Result>(`/study/topics/${practice.topicId}/quiz/submit`, { answers: practice.questions.map(q => ({ questionId: q.id, ...(['MCQ', 'TRUE_FALSE'].includes(q.questionType) ? { selectedAnswer: answers[q.id] ?? '' } : { textAnswer: answers[q.id] ?? '' }) })) }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not mark practice') }
    finally { setBusy(false) }
  }
  return <div className="space-y-6">
    <Link href="/exam-preparation" className="text-sm text-violet-700">← My exams and subjects</Link>
    <h1 className="text-2xl font-semibold">{subject?.name ?? 'Subject'} practice {goal ? `· ${goal.exam} ${goal.year}` : ''}</h1>
    <p className="text-sm text-slate-500">Practise reviewed questions and read shared teacher notes. This is untimed practice, separate from a full exam mock.</p>
    {loading && <p role="status">Loading subject…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4">{message}</p>}
    {!loading && subject && <>
      {!practice || result ? <form className="card space-y-4 p-5" onSubmit={start}>
        <h2 className="font-semibold">{result ? 'Start another practice' : 'Start practice'}</h2>
        <label className="block text-sm">Topic (optional)<input className="input-base mt-1" value={topic} maxLength={150} onChange={e => setTopic(e.target.value)} placeholder="Leave blank for all reviewed topics" /></label>
        <label className="block text-sm">Questions<input className="input-base mt-1" type="number" min={1} max={20} value={count} onChange={e => setCount(Number(e.target.value))} /></label>
        <button className="btn-primary" disabled={busy}>{busy ? 'Preparing…' : 'Start reviewed practice'}</button>
      </form> : null}
      {practice && <section className="space-y-4">
        {practice.actualCount < practice.requestedCount && <p className="text-sm text-slate-600">{practice.actualCount} reviewed questions available for this selection; you requested {practice.requestedCount}.</p>}
        {result && <div className="card p-5"><h2 className="text-xl font-semibold">{result.scorePercent === null ? 'Awaiting marking' : `${result.scorePercent}% on graded questions`}</h2>{result.gradingFailed && <p className="mt-2 text-sm">Some written answers could not be marked. Compare with the model answers below; this score excludes ungraded answers.</p>}
          {result.attemptId && <button className="btn-secondary mt-3" disabled={busy} onClick={async () => { setBusy(true); try { await api.post(`/study/quiz-attempts/${result.attemptId}/flashcards`, {}); setMessage('Revision cards created from your mistakes.') } catch (err) { setError(err instanceof Error ? err.message : 'Could not create cards') } finally { setBusy(false) } }}>Create revision cards from mistakes</button>}</div>}
        {practice.questions.map((q, index) => { const marked = result?.results.find(r => r.questionId === q.id); return <article key={q.id} className="card space-y-3 p-5">
          <h2 className="whitespace-pre-wrap font-semibold">{index + 1}. {q.questionText}</h2>
          <fieldset disabled={busy || !!result}><legend className="sr-only">Your answer to question {index + 1}</legend>
            {['MCQ', 'TRUE_FALSE'].includes(q.questionType) ? (q.questionType === 'TRUE_FALSE' ? [{ key: 'true', text: 'True' }, { key: 'false', text: 'False' }] : q.options ?? []).map(o => <label key={o.key} className="mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3"><input type="radio" name={q.id} checked={answers[q.id] === o.key} onChange={() => setAnswers(a => ({ ...a, [q.id]: o.key }))} /><span>{o.key}. {o.text}</span></label>) : <textarea aria-label={`Written answer to question ${index + 1}`} className="input-base min-h-36" maxLength={6000} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />}
          </fieldset>
          {marked && <div className="space-y-2 rounded-xl bg-violet-50 p-4 text-sm"><p>{marked.score === null ? 'Ungraded' : `${marked.score}/${marked.maxScore}`}</p><p><strong>Model answer:</strong> {marked.correctAnswer}</p><p className="whitespace-pre-wrap">{marked.explanation}</p>{marked.feedback && <p>{marked.feedback}</p>}{marked.missingPoints?.map(point => <p key={point}>• {point}</p>)}</div>}
        </article> })}
        {!result && <div className="space-y-3"><p className="text-sm text-slate-500">{Object.values(answers).filter(a => a.trim()).length} of {practice.questions.length} answered. Blank answers are submitted as blank.</p><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Marking…' : 'Submit practice'}</button></div>}
      </section>}
      <section className="space-y-3"><h2 className="text-lg font-semibold">Teacher notes</h2>{materials.length === 0 && <p className="text-sm text-slate-500">No shared notes published yet. You can upload your own notes in the subject workspace.</p>}{materials.map(m => <details className="card p-5" key={m.id}><summary className="cursor-pointer font-semibold">{m.title} · {m.topic}</summary><p className="mt-2 text-xs text-slate-500">Source: {m.sourceNote}</p><div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</div></details>)}</section>
    </>}
  </div>
}
export default function BankPracticePage() { return <Suspense fallback={<p>Loading practice…</p>}><PracticeScreen /></Suspense> }
