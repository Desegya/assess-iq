'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
interface MockQuestion { id: string; subjectKey: string; subject: string; topic: string; questionText: string; options: { key: string; text: string }[]; correctAnswer?: string; explanation?: string }
interface Attempt { id: string; status: string; version: number; answers: Record<string, string>; flags: string[]; expiresAt: string; serverTime: string; submissionReason: string | null; questions: MockQuestion[]; specification: { title: string; instructions: string; durationMinutes: number }; result: { practiceScore: number; scoringNote: string; subjects: { subject: string; correct: number; total: number; unanswered: number; practiceScore: number; topics: { topic: string; total: number; correct: number }[] }[] } | null }
interface Availability { ready: boolean; template: { title: string; instructions: string; durationMinutes: number } | null; subjects: { name: string; available: number; required: number | null }[]; active: { id: string } | null }
function MockScreen() {
  const api = useApi()
  const params = useSearchParams()
  const goalId = params.get('goal') ?? ''
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [history, setHistory] = useState<{ id: string; goalId: string; status: string; startedAt: string }[]>([])
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flags, setFlags] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const version = useRef(1)
  const dirty = useRef(false)
  const saving = useRef(false)
  const answersRef = useRef<Record<string, string>>({})
  const flagsRef = useRef<string[]>([])
  const changeSerial = useRef(0)
  const clockOffset = useRef(0)
  const conflict = useRef(false)
  const attemptRef = useRef<Attempt | null>(null)
  const requestKey = useRef('')
  function install(value: Attempt) {
    attemptRef.current = value; setAttempt(value); version.current = value.version
    clockOffset.current = Date.parse(value.serverTime) - Date.now()
    answersRef.current = value.answers; flagsRef.current = value.flags; setAnswers(value.answers); setFlags(value.flags)
    dirty.current = false; conflict.current = false; setSaveState('All answers saved'); setConfirmSubmit(false)
  }
  useEffect(() => {
    let active = true
    Promise.all([api.get<Availability>(`/exam-preparation/goals/${encodeURIComponent(goalId)}/mock-availability`), api.get<typeof history>('/exam-preparation/mocks')])
      .then(([a, h]) => { if (active) { setAvailability(a); setHistory(h) } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load mocks') })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, goalId])
  async function load(id: string) {
    setBusy(true); setError('')
    try { install(await api.get<Attempt>(`/exam-preparation/mocks/${id}`)); setCurrent(0) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load attempt') }
    finally { setBusy(false) }
  }
  async function save() {
    const active = attemptRef.current
    if (!active || active.status !== 'IN_PROGRESS' || !dirty.current || saving.current || conflict.current) return !dirty.current
    saving.current = true; setSaveState('Saving…')
    const serial = changeSerial.current
    try {
      const response = await api.patch<{ version: number }>(`/exam-preparation/mocks/${active.id}/answers`, { expectedVersion: version.current, answers: Object.entries(answersRef.current).map(([questionId, answer]) => ({ questionId, answer })), flags: flagsRef.current })
      version.current = response.version
      dirty.current = changeSerial.current !== serial
      setSaveState(dirty.current ? 'Saving new changes…' : `Saved at ${new Date().toLocaleTimeString()}`)
      return !dirty.current
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save'
      if (/reload|another request|changed|ended|expired/i.test(message)) { conflict.current = true; setError(message) }
      setSaveState('Changes not yet saved. Keep this page open; reconnect to retry.')
      return false
    } finally { saving.current = false }
  }
  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return
    const tick = () => {
      const left = Math.max(0, Math.ceil((Date.parse(attempt.expiresAt) - Date.now() - clockOffset.current) / 1000))
      setSeconds(left)
      if (!left && !saving.current) {
        api.get<Attempt>(`/exam-preparation/mocks/${attempt.id}`).then(value => { if (value.status !== 'IN_PROGRESS') install(value) }).catch(() => setSaveState('Time ended. Reconnect to retrieve the saved result.'))
      } else if (left) void save()
    }
    tick(); const timer = setInterval(tick, 1000)
    const unload = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', unload)
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', unload) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, attempt?.id, attempt?.status])
  function answer(questionId: string, answer: string) { const next = { ...answersRef.current, [questionId]: answer }; answersRef.current = next; setAnswers(next); dirty.current = true; changeSerial.current++; setSaveState('Unsaved changes') }
  function toggleFlag(id: string) { const next = flagsRef.current.includes(id) ? flagsRef.current.filter(f => f !== id) : [...flagsRef.current, id]; flagsRef.current = next; setFlags(next); dirty.current = true; changeSerial.current++ }
  async function submit() {
    if (!attempt || saving.current) return
    setBusy(true); setError('')
    try {
      if (dirty.current && !(await save())) { setError('Wait for all answers to save before submitting.'); return }
      install(await api.post<Attempt>(`/exam-preparation/mocks/${attempt.id}/submit`, {}))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit') }
    finally { setBusy(false) }
  }
  const q = attempt?.questions[current]
  return <div className="space-y-5"><Link href="/exam-preparation" className="text-sm text-violet-700">← My exams</Link><h1 className="text-2xl font-semibold">JAMB timed practice mock</h1>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700"><p>{error}</p>{attempt && <button className="btn-secondary mt-2" disabled={busy} onClick={() => load(attempt.id)}>Reload server-saved attempt</button>}</div>}
    {!attempt && <>
      {!availability && !error && <p role="status">Checking reviewed question coverage…</p>}
      {availability && <section className="card space-y-4 p-5"><h2 className="text-lg font-semibold">{availability.template?.title ?? 'Mock specification not published yet'}</h2><p className="whitespace-pre-wrap text-sm">{availability.template?.instructions}</p><p className="text-sm">{availability.template ? `${availability.template.durationMinutes} minutes. The timer continues if you close this page or lose connectivity. Only confirmed saved answers can be marked.` : 'Your teacher needs to publish the exam-year specification first.'}</p>
        <div className="space-y-2">{availability.subjects.map(s => <p key={s.name} className="text-sm">{s.name}: {s.available} reviewed questions available{s.required ? `; ${s.required} required` : ''}</p>)}</div>
        {!availability.ready && <p className="text-sm text-slate-500">A complete reviewed paper is not ready yet. Continue topic practice while your teacher builds the bank.</p>}
        {availability.active ? <button className="btn-primary" disabled={busy} onClick={() => load(availability.active!.id)}>Resume saved mock</button> : <button className="btn-primary" disabled={busy || !availability.ready} onClick={async () => { setBusy(true); setError(''); try { requestKey.current ||= crypto.randomUUID(); install(await api.post<Attempt>('/exam-preparation/mocks', { goalId, requestKey: requestKey.current })) } catch (err) { setError(err instanceof Error ? err.message : 'Could not start') } finally { setBusy(false) } }}>{busy ? 'Starting…' : 'Start timed mock'}</button>}
      </section>}
      <section className="card space-y-3 p-5"><h2 className="font-semibold">Previous attempts</h2>{history.filter(h => h.goalId === goalId).map(h => <button className="btn-secondary mr-2" key={h.id} disabled={busy} onClick={() => load(h.id)}>{new Date(h.startedAt).toLocaleDateString()} · {h.status === 'IN_PROGRESS' ? 'Resume' : 'Review result'}</button>)}</section>
    </>}
    {attempt?.status === 'IN_PROGRESS' && q && <>
      <div className="sticky top-[72px] z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><p role="timer" className="font-mono text-xl">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p><p role="status" className="text-xs">{saveState}</p><p className="text-sm">{Object.values(answers).filter(Boolean).length}/{attempt.questions.length} answered</p></div>
      <div className="flex flex-wrap gap-2">{[...new Set(attempt.questions.map(item => item.subjectKey))].map(key => <button className="btn-secondary" key={key} onClick={() => setCurrent(attempt.questions.findIndex(item => item.subjectKey === key))}>{attempt.questions.find(item => item.subjectKey === key)!.subject}</button>)}</div>
      <article className="card space-y-4 p-5"><p className="text-sm text-slate-500">{q.subject} · question {current + 1} of {attempt.questions.length}</p><h2 className="whitespace-pre-wrap font-semibold">{q.questionText}</h2><fieldset disabled={busy || seconds <= 0 || conflict.current}><legend className="sr-only">Choose your answer</legend>{q.options.map(o => <label key={o.key} className="mb-2 flex gap-3 rounded-xl border p-3"><input type="radio" name={q.id} checked={answers[q.id] === o.key} onChange={() => answer(q.id, o.key)} /><span>{o.key}. {o.text}</span></label>)}</fieldset>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={busy || seconds <= 0} onClick={() => answer(q.id, '')}>Clear answer</button><button className="btn-secondary" aria-pressed={flags.includes(q.id)} disabled={busy || seconds <= 0} onClick={() => toggleFlag(q.id)}>{flags.includes(q.id) ? 'Unflag question' : 'Flag for review'}</button><button className="btn-secondary" disabled={current === 0} onClick={() => setCurrent(i => i - 1)}>Previous</button><button className="btn-secondary" disabled={current === attempt.questions.length - 1} onClick={() => setCurrent(i => i + 1)}>Next</button></div>
      </article>
      <details className="card p-4"><summary className="cursor-pointer font-medium">Question navigator · purple = answered · ★ = flagged</summary><div className="mt-3 flex flex-wrap gap-2">{attempt.questions.map((item,i) => <button key={item.id} className={`min-h-11 min-w-11 rounded-lg border p-2 ${answers[item.id] ? 'bg-violet-100 text-violet-900' : 'bg-white'}`} aria-label={`Question ${i+1}${answers[item.id] ? ', answered' : ', unanswered'}${flags.includes(item.id) ? ', flagged' : ''}`} aria-current={current === i ? 'step' : undefined} onClick={() => setCurrent(i)}>{i+1}{flags.includes(item.id) ? '★' : ''}</button>)}</div></details>
      {confirmSubmit ? <section className="card space-y-3 p-5"><p>{attempt.questions.length - Object.values(answers).filter(Boolean).length} unanswered; {flags.length} flagged. Submitting ends this attempt.</p><button className="btn-primary" disabled={busy || saving.current} onClick={submit}>{busy ? 'Submitting…' : 'Confirm submission'}</button><button className="btn-secondary ml-3" onClick={() => setConfirmSubmit(false)}>Keep working</button></section> : <button className="btn-primary" disabled={busy} onClick={() => setConfirmSubmit(true)}>Review & submit</button>}
    </>}
    {attempt?.result && <section className="space-y-4"><div className="card space-y-3 p-5"><h2 className="text-xl font-semibold">Practice estimate: {attempt.result.practiceScore}/400</h2><p className="text-sm">{attempt.result.scoringNote}</p><p className="text-sm">{attempt.submissionReason === 'TIME_EXPIRED' ? 'Time expired. Confirmed saved answers were marked.' : 'Submitted successfully.'}</p></div>{attempt.result.subjects.map(s => <div key={s.subject} className="card p-5"><h3 className="font-semibold">{s.subject}: {s.practiceScore}/100</h3><p className="text-sm">{s.correct}/{s.total} correct · {s.unanswered} unanswered</p>{s.topics.map(t => <p className="mt-1 text-sm text-slate-600" key={t.topic}>{t.topic}: {t.correct}/{t.total}{t.correct / t.total < 0.6 ? ' · revise this topic' : ''}</p>)}</div>)}<h2 className="text-lg font-semibold">Answer review</h2>{attempt.questions.map((item,i) => <details className="card p-4" key={item.id}><summary className="cursor-pointer">{i+1}. {item.questionText}</summary><p className="mt-3 text-sm">Your answer: {answers[item.id] || 'Unanswered'} · Correct answer: {item.correctAnswer}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.explanation}</p></details>)}</section>}
  </div>
}
export default function MockPage() { return <Suspense fallback={<p>Loading mocks…</p>}><MockScreen /></Suspense> }
