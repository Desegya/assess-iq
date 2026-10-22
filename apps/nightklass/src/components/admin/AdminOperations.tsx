'use client'
import { useState } from 'react'
import { adminRequest, useAdminData } from './admin-api'

interface Setting {
  key: string
  value: boolean | number | string
  overridden: boolean
  default: boolean | number | string
}
interface Summary {
  generatedAt: string
  attention: Record<string, number>
  queues: { writtenMarking: number; generation: number }
  ai: {
    measuredAndReservedUsd: number
    requests: number
    failures: number
    byAction: { action: string; requests: number; costUsd: number }[]
    note: string
  }
  settings: Setting[]
}
interface Report {
  id: string
  reason: string
  details: string
  createdAt: string
  question: { id: string; exam: string; subject: string; topic: string; questionText: string; status: string }
}
interface Member {
  userId: string
  name: string
  email: string
  addedAt: string
}

const LABELS: Record<string, string> = {
  'ai.paused': 'Pause all AI features (kill switch)',
  'ai.userDailyBudgetUsd': 'Learner AI budget per 24 h (USD)',
  'ai.adminDailyBudgetUsd': 'Content-admin AI budget per 24 h (USD)',
  'ai.userDailyRequests': 'Learner AI requests per 24 h',
  'ai.globalDailyBudgetUsd': 'Total AI budget per 24 h (USD)',
  'exam.access': 'WAEC/JAMB access (COHORT = invited learners only)',
  'exam.newAttemptsPaused': 'Pause new mock starts (in-progress mocks can finish)',
}
const ATTENTION: Record<string, string> = {
  attemptsPastExpiryNotFinalized: 'Mocks past their deadline but not finalized',
  writtenMarkingOlderThan10Minutes: 'Written marking waiting over 10 minutes',
  writtenMarkingFailedLast24h: 'Written marking failed (24 h)',
  generationJobsFailedLast24h: 'Generation jobs failed (24 h)',
  openQuestionReports: 'Open learner question reports',
}

export function AdminOperations() {
  const summary = useAdminData<Summary>('operations/summary')
  const reports = useAdminData<Report[]>('exam-content/question-reports')
  const cohort = useAdminData<Member[]>('operations/exam-cohort')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  async function act(fn: () => Promise<unknown>, done: string) {
    setMessage('')
    try {
      await fn()
      setMessage(done)
      summary.reload()
      reports.reload()
      cohort.reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed')
    }
  }
  const setSetting = (key: string, value: unknown) =>
    act(() => adminRequest('operations/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }), 'Setting saved. It takes effect within seconds.')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Operations</h1>
      {message && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
      {(summary.error || reports.error || cohort.error) && (
        <p role="alert" className="text-sm text-red-700">{summary.error || reports.error || cohort.error}</p>
      )}

      {summary.data && (
        <>
          <section className="card space-y-2 p-5">
            <h2 className="font-semibold">Needs attention</h2>
            {Object.entries(summary.data.attention).map(([key, n]) => (
              <p key={key} className={`text-sm ${n ? 'font-semibold text-amber-700' : ''}`}>
                {ATTENTION[key] ?? key}: {n}
              </p>
            ))}
            <p className="text-sm text-slate-500">
              Queues — written marking: {summary.data.queues.writtenMarking}, generation: {summary.data.queues.generation}
            </p>
          </section>

          <section className="card space-y-2 p-5">
            <h2 className="font-semibold">AI usage (last 24 h)</h2>
            <p className="text-sm">
              ${summary.data.ai.measuredAndReservedUsd.toFixed(2)} · {summary.data.ai.requests} requests ·{' '}
              {summary.data.ai.failures} failures
            </p>
            {summary.data.ai.byAction.map((a) => (
              <p key={a.action} className="text-sm text-slate-600">
                {a.action}: {a.requests} · ${a.costUsd.toFixed(3)}
              </p>
            ))}
            <p className="text-xs text-slate-500">{summary.data.ai.note}</p>
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">Switches and limits</h2>
            <p className="text-xs text-slate-500">Only owners can change these. Every change is recorded in the audit history.</p>
            {summary.data.settings.map((s) => (
              <div key={s.key} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-72">{LABELS[s.key] ?? s.key}</span>
                {typeof s.value === 'boolean' ? (
                  <button className="btn-secondary" onClick={() => setSetting(s.key, !s.value)}>
                    {s.value ? 'On — turn off' : 'Off — turn on'}
                  </button>
                ) : s.key === 'exam.access' ? (
                  <button className="btn-secondary" onClick={() => setSetting(s.key, s.value === 'OPEN' ? 'COHORT' : 'OPEN')}>
                    {String(s.value)} — switch to {s.value === 'OPEN' ? 'COHORT' : 'OPEN'}
                  </button>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const value = new FormData(e.currentTarget).get('value')
                      void setSetting(s.key, Number(value))
                    }}
                  >
                    <input name="value" type="number" step="any" min={0} defaultValue={String(s.value)} className="input-base w-28" aria-label={LABELS[s.key] ?? s.key} />
                    <button className="btn-secondary">Save</button>
                  </form>
                )}
                {s.overridden && (
                  <button className="text-xs text-violet-700 underline" onClick={() => setSetting(s.key, null)}>
                    Reset to default ({String(s.default)})
                  </button>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Pilot cohort</h2>
        <p className="text-xs text-slate-500">When exam access is COHORT, only these learners can use WAEC/JAMB preparation.</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void act(() => adminRequest('operations/exam-cohort', { method: 'POST', body: JSON.stringify({ email }) }), 'Learner added to the pilot cohort.').then(() => setEmail(''))
          }}
        >
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" placeholder="learner@example.com" aria-label="Learner email" />
          <button className="btn-primary">Add learner</button>
        </form>
        {cohort.data?.map((m) => (
          <p key={m.userId} className="flex items-center gap-3 text-sm">
            {m.name} · {m.email}
            <button className="text-xs text-red-700 underline" onClick={() => act(() => adminRequest(`operations/exam-cohort/${m.userId}`, { method: 'DELETE' }), 'Learner removed from the cohort.')}>
              Remove
            </button>
          </p>
        ))}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Learner question reports</h2>
        {reports.data?.length === 0 && <p className="text-sm text-slate-500">No open reports.</p>}
        {reports.data?.map((r) => (
          <article key={r.id} className="space-y-2 rounded-xl border p-3 text-sm">
            <p className="font-medium">
              {r.reason.replaceAll('_', ' ')} · {r.question.exam} {r.question.subject} · {r.question.topic}
            </p>
            <p className="whitespace-pre-wrap text-slate-700">{r.question.questionText}</p>
            <p className="whitespace-pre-wrap">Learner: {r.details}</p>
            <div className="flex flex-wrap gap-2">
              <a className="btn-secondary" href={`/admin/exam-content?question=${r.question.id}`}>
                Open question
              </a>
              {(['RESOLVED', 'DISMISSED'] as const).map((status) => (
                <button
                  key={status}
                  className="btn-secondary"
                  onClick={() => {
                    const note = window.prompt(status === 'RESOLVED' ? 'What did you change?' : 'Why is no change needed?')
                    if (note && note.trim().length >= 3)
                      void act(() => adminRequest(`exam-content/question-reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status, resolutionNote: note }) }), 'Report updated.')
                  }}
                >
                  {status === 'RESOLVED' ? 'Mark resolved' : 'Dismiss'}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
