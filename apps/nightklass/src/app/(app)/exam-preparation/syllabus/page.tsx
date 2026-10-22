'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
interface Coverage {
  syllabus: {
    id: string
    title: string
    version: number
    provenance: string
    sourceUrl: string | null
    sourceNote: string
  } | null
  objectives: {
    id: string
    code: string
    title: string
    description: string
    reviewedQuestions: number
    topicId: string | null
    studied: boolean
    practiceAccuracy: number | null
  }[]
  summary: { total: number; withReviewedPractice: number; studied: number; assessed: number }
  note: string
}
function SyllabusScreen() {
  const api = useApi(),
    params = useSearchParams(),
    router = useRouter()
  const goal = params.get('goal') ?? '',
    subject = params.get('subject') ?? ''
  const [data, setData] = useState<Coverage | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  useEffect(() => {
    let current = true
    api
      .get<Coverage>(
        `/exam-preparation/goals/${encodeURIComponent(goal)}/subjects/${encodeURIComponent(subject)}/coverage`,
      )
      .then((v) => {
        if (current) setData(v)
      })
      .catch((err) => {
        if (current) setError(err instanceof Error ? err.message : 'Could not load syllabus')
      })
    return () => {
      current = false
    }
  }, [api, goal, subject])
  async function study(id: string) {
    setBusy(id)
    setError('')
    try {
      const result = await api.post<{ topicId: string }>('/exam-preparation/objectives/study', {
        goalId: goal,
        objectiveId: id,
      })
      router.push(`/topics/${result.topicId}/learn`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open objective')
      setBusy('')
    }
  }
  const revision =
    data?.objectives
      .filter((o) => o.practiceAccuracy !== null && o.practiceAccuracy < 60)
      .sort((a, b) => a.practiceAccuracy! - b.practiceAccuracy!) ?? []
  return (
    <div className="space-y-5">
      <Link className="text-sm text-violet-700" href="/exam-preparation">
        ← My exams
      </Link>
      <h1 className="text-2xl font-semibold">Syllabus & coverage</h1>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading syllabus…</p>}
      {data && (
        <>
          <p className="text-sm text-slate-500">{data.note}</p>
          {data.syllabus && (
            <section className="card space-y-3 p-5">
              <h2 className="text-lg font-semibold">
                {data.syllabus.title} · version {data.syllabus.version}
              </h2>
              <p className="text-sm">
                {data.syllabus.provenance === 'OFFICIAL'
                  ? 'Official source verified by the content publisher'
                  : 'Teacher-curated syllabus'}
              </p>
              <p className="text-sm text-slate-500">{data.syllabus.sourceNote}</p>
              {data.syllabus.sourceUrl && (
                <a
                  className="text-sm text-violet-700 underline"
                  href={data.syllabus.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View syllabus source
                </a>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <p>{data.summary.total} objectives</p>
                <p>{data.summary.withReviewedPractice} with reviewed practice</p>
                <p>{data.summary.studied} studied</p>
                <p>{data.summary.assessed} assessed</p>
              </div>
            </section>
          )}
          {revision.length > 0 && (
            <section className="card space-y-3 p-5">
              <h2 className="font-semibold">Revise these next</h2>
              {revision.slice(0, 5).map((o) => (
                <button
                  disabled={!!busy}
                  className="btn-secondary mr-2"
                  key={o.id}
                  onClick={() => study(o.id)}
                >
                  {o.title} · {o.practiceAccuracy}%
                </button>
              ))}
            </section>
          )}
          {data.objectives.map((o) => (
            <article className="card space-y-3 p-5" key={o.id}>
              <h2 className="font-semibold">
                {o.code} · {o.title}
              </h2>
              <p className="text-sm">{o.description}</p>
              <p className="text-sm text-slate-500">
                {o.reviewedQuestions} reviewed questions ·{' '}
                {o.studied ? 'Studied' : 'Not recorded as studied'} ·{' '}
                {o.practiceAccuracy === null
                  ? 'No assessed practice evidence yet'
                  : `${o.practiceAccuracy}% practice accuracy`}
              </p>
              <div className="flex flex-wrap gap-3">
                <button className="btn-primary" disabled={!!busy} onClick={() => study(o.id)}>
                  {busy === o.id ? 'Opening…' : 'Study objective'}
                </button>
                <Link
                  className="btn-secondary"
                  href={`/exam-preparation/practice?goal=${goal}&subject=${encodeURIComponent(subject)}&objective=${o.id}&topic=${encodeURIComponent(o.title)}`}
                >
                  Practise topic
                </Link>
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  )
}
export default function SyllabusPage() {
  return (
    <Suspense fallback={<p>Loading syllabus…</p>}>
      <SyllabusScreen />
    </Suspense>
  )
}
