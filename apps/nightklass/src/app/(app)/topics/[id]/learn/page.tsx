'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { Icon } from '@/components/product/Icon'
import { StudyArtwork } from '@/components/product/StudyArtwork'
import { useApi } from '@/hooks/use-api'
import { SkeletonCard } from '@/components/ui/Skeleton'

type Mode = 'COMBINED' | 'MATERIAL' | 'AI'

interface LessonContent {
  objectives: string[]
  introduction: string
  sections: { heading: string; body: string }[]
  keyTerms: { term: string; definition: string }[]
  workedExamples: { title: string; problem: string; steps: string[]; answer: string }[]
  applications: string[]
  diagramIdeas: string[]
  summary: string[]
  examQuestions: { question: string; type: 'short' | 'structured' | 'essay' | 'calculation' }[]
}

interface Lesson {
  id: string
  version: number
  mode: Mode
  content: LessonContent
  createdAt: string
  sources: { marker: string; documentName: string; excerpt: string | null }[]
}

interface LessonResponse {
  topic: { id: string; name: string; courseId: string; courseTitle: string; subtopics: string[] }
  hasMaterial: boolean
  versions: { id: string; version: number; mode: Mode; createdAt: string }[]
  lesson: Lesson | null
}

interface Resources {
  videos: { id: string; title: string; channel: string; thumbnail: string; url: string }[]
  searches: { label: string; url: string }[]
  videosConfigured: boolean
}

const MODE_LABEL: Record<Mode, string> = {
  COMBINED: 'My notes + AI',
  MATERIAL: 'Only my notes',
  AI: 'AI only',
}

const MODE_BANNER: Record<Mode, { text: string; className: string }> = {
  COMBINED: {
    text: 'Built from your uploaded notes, with AI filling the gaps. Anything taken from your notes is cited, like [S1].',
    className: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  },
  MATERIAL: {
    text: 'Built only from your uploaded notes. Each point is cited to the passage it came from.',
    className: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  },
  AI: {
    text: 'AI-generated from general university knowledge, not from your notes. Upload your lecture notes for a lesson matched to your lecturer.',
    className: 'bg-violet-50 border-violet-100 text-violet-800',
  },
}

const QUESTION_TYPE_LABEL = { short: 'Short answer', structured: 'Structured', essay: 'Essay', calculation: 'Calculation' }

// Turn [S1] markers into in-page links to the cited passage
function withCitationLinks(text: string) {
  return text.replace(/\[(S\d+)\]/g, '[$1](#source-$1)')
}

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: props => <p className="mb-3 last:mb-0" {...props} />,
        ul: props => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
        ol: props => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
        strong: props => <strong className="font-semibold text-slate-900" {...props} />,
        h3: props => <h4 className="font-semibold text-slate-900 mt-3 mb-1" {...props} />,
        code: props => <code className="bg-slate-100 rounded px-1 py-0.5 text-[13px]" {...props} />,
        a: ({ href, children: label }) =>
          href?.startsWith('#source-') ? (
            <a
              href={href}
              className="inline-block align-super text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded px-1 mx-0.5 no-underline hover:bg-emerald-100"
            >
              {label}
            </a>
          ) : (
            <a href={href} className="text-violet-600 underline" target="_blank" rel="noreferrer">
              {label}
            </a>
          ),
      }}
    >
      {withCitationLinks(children)}
    </ReactMarkdown>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section id={`lesson-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="lesson-section scroll-mt-24">
      <h2 className="font-heading font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </section>
  )
}

export default function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()

  const [data, setData] = useState<LessonResponse | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [resources, setResources] = useState<Resources | null>(null)
  const [mode, setMode] = useState<Mode>('COMBINED')
  const [feedback, setFeedback] = useState('')
  const [panel, setPanel] = useState<'regenerate' | 'report' | null>(null)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    return api
      .get<LessonResponse>(`/learning/topics/${id}/lesson`)
      .then(r => {
        setData(r)
        setLesson(r.lesson)
        if (!r.hasMaterial) setMode('AI')
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load lesson'))
  }

  useEffect(() => {
    void load()
    api.get<Resources>(`/learning/topics/${id}/resources`).then(setResources).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function generate(withFeedback?: string) {
    setError(null)
    setNotice(null)
    setGenerating(true)
    try {
      await api.post<Lesson>(`/learning/topics/${id}/lesson/generate`, {
        mode,
        ...(withFeedback?.trim() && { feedback: withFeedback.trim() }),
      })
      setPanel(null)
      setFeedback('')
      await load()
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the lesson')
    } finally {
      setGenerating(false)
    }
  }

  async function report() {
    if (!lesson || feedback.trim().length < 5) return
    setError(null)
    try {
      await api.post(`/learning/lessons/${lesson.id}/report`, { reason: feedback.trim() })
      setNotice('Thanks, reported. Regenerate below to get a corrected version that takes your feedback into account.')
      setPanel('regenerate')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send report')
    }
  }

  async function showVersion(lessonId: string) {
    setLesson(await api.get<Lesson>(`/learning/lessons/${lessonId}`))
  }

  if (!data && !error) return <div className="max-w-3xl space-y-4"><SkeletonCard /><SkeletonCard /></div>

  const modePicker = data && (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(MODE_LABEL) as Mode[]).map(m => {
        const disabled = m !== 'AI' && !data.hasMaterial
        return (
          <button
            key={m}
            type="button"
            disabled={disabled || generating}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            title={disabled ? 'Upload notes for this course first' : undefined}
            className={`text-xs font-semibold rounded-xl px-3 py-2 transition-colors disabled:opacity-40 ${
              mode === m ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        )
      })}
    </div>
  )

  const c = lesson?.content
  const latest = data?.versions[0]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        {data && (
          <Link href={`/courses/${data.topic.courseId}`} className="text-sm text-violet-600 font-semibold">
            ← Back to {data.topic.courseTitle}
          </Link>
        )}
        <h1 className="font-heading text-2xl font-bold text-slate-900 mt-2">{data?.topic.name ?? 'Lesson'}</h1>
        {data && data.topic.subtopics.length > 0 && (
          <p className="text-slate-400 text-sm mt-1">{data.topic.subtopics.join(' · ')}</p>
        )}
      </div>

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      {notice && <div className="bg-violet-50 border border-violet-100 text-violet-800 text-sm rounded-xl px-4 py-3">{notice}</div>}

      {data && !lesson && (
        <section className="relative overflow-hidden rounded-[20px] border border-[#e6d8fb] bg-[#f7f2ff] p-6 lg:pr-[230px]">
          <StudyArtwork className="absolute bottom-5 right-4 hidden !w-48 lg:block" />
          <h2 className="font-heading font-bold text-slate-900">Your lesson for this topic</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Objectives, detailed explanations, worked examples, key terms, a summary and likely exam questions.
          </p>
          {data.hasMaterial ? (
            <p className="text-xs text-slate-500 mb-2">Build it from:</p>
          ) : (
            <p className="text-xs text-slate-500 mb-3">
              No notes uploaded for this course yet, so the lesson will be AI-generated. Upload lecture notes on the course page
              to get a lesson built from your own material.
            </p>
          )}
          {data.hasMaterial && <div className="mb-4">{modePicker}</div>}
          <button onClick={() => void generate()} disabled={generating} className="btn-primary">
            {generating ? 'Writing your lesson… (about 10 seconds)' : 'Generate lesson'}
          </button>
        </section>
      )}

      {lesson && c && (
        <>
          <div className={`text-xs border rounded-lg px-3 py-2 ${MODE_BANNER[lesson.mode].className}`}>
            {MODE_BANNER[lesson.mode].text}
          </div>

          {data && data.versions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor="version" className="text-slate-500">Version</label>
              <select
                id="version"
                value={lesson.id}
                onChange={e => void showVersion(e.target.value)}
                className="input-base !py-1 !w-auto max-w-full text-xs"
              >
                {data.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    v{v.version} · {MODE_LABEL[v.mode]} · {new Date(v.createdAt).toLocaleDateString()}
                    {v.id === latest?.id ? ' (latest)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav aria-label="Lesson contents" className="rounded-2xl border border-[#eae6ef] bg-white p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500"><Icon name="book" className="h-4 w-4 text-violet-700" />In this lesson</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {["What you'll learn", ...c.sections.map((section, index) => `${index + 1}. ${section.heading}`), ...(c.workedExamples.length ? ['Worked examples'] : []), ...(c.keyTerms.length ? ['Key terms'] : []), 'Summary'].map(title => <a key={title} href={`#lesson-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="inline-flex min-h-11 items-center text-xs font-medium text-violet-700 hover:underline">{title}</a>)}
            </div>
          </nav>
          <div className="rounded-[20px] border border-[#eae6ef] bg-white px-5 sm:px-8 lg:px-10">
          <Card title="What you'll learn">
            <ul className="list-disc pl-5 space-y-1 mb-4">
              {c.objectives.map((o, i) => (
                <li key={i}><Md>{o}</Md></li>
              ))}
            </ul>
            <Md>{c.introduction}</Md>
          </Card>

          {c.sections.map((s, i) => (
            <Card key={i} title={`${i + 1}. ${s.heading}`}>
              <Md>{s.body}</Md>
            </Card>
          ))}

          {c.workedExamples.length > 0 && (
            <Card title="Worked examples">
              <div className="space-y-5">
                {c.workedExamples.map((w, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{w.title}</p>
                    <div className="mt-1"><Md>{w.problem}</Md></div>
                    <ol className="list-decimal pl-5 mt-2 space-y-1">
                      {w.steps.map((step, j) => (
                        <li key={j}><Md>{step}</Md></li>
                      ))}
                    </ol>
                    <p className="mt-2 font-semibold text-emerald-700">Answer: {w.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {c.keyTerms.length > 0 && (
            <Card title="Key terms">
              <dl className="space-y-2">
                {c.keyTerms.map((k, i) => (
                  <div key={i}>
                    <dt className="font-semibold text-slate-900">{k.term}</dt>
                    <dd className="text-slate-600"><Md>{k.definition}</Md></dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {(c.applications.length > 0 || c.diagramIdeas.length > 0) && (
            <Card title="In practice">
              {c.applications.length > 0 && (
                <ul className="list-disc pl-5 space-y-1">
                  {c.applications.map((a, i) => (
                    <li key={i}><Md>{a}</Md></li>
                  ))}
                </ul>
              )}
              {c.diagramIdeas.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Draw it yourself</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    {c.diagramIdeas.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Card title="Summary">
            <ul className="list-disc pl-5 space-y-1">
              {c.summary.map((s, i) => (
                <li key={i}><Md>{s}</Md></li>
              ))}
            </ul>
          </Card>

          {c.examQuestions.length > 0 && (
            <Card title="Likely exam questions">
              <ol className="list-decimal pl-5 space-y-2">
                {c.examQuestions.map((q, i) => (
                  <li key={i}>
                    <Md>{q.question}</Md>
                    <span className="badge bg-slate-100 text-slate-500 !text-[10px] mt-1">{QUESTION_TYPE_LABEL[q.type]}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {lesson.sources.length > 0 && (
            <Card title="Sources from your notes">
              <ul className="space-y-3">
                {lesson.sources.map(s => (
                  <li key={s.marker} id={`source-${s.marker}`} className="scroll-mt-24">
                    <p className="text-xs font-semibold text-emerald-700">
                      [{s.marker}] {s.documentName}
                    </p>
                    {s.excerpt ? (
                      <details className="mt-1">
                        <summary className="text-xs text-slate-500 cursor-pointer">Show passage</summary>
                        <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{s.excerpt}</p>
                      </details>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">This document has since been removed.</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/topics/${id}/quiz`} className="btn-primary">
              <Icon name="target" />Quiz me on this
            </Link>
            <button onClick={() => setPanel(panel === 'regenerate' ? null : 'regenerate')} className="btn-secondary">
              Regenerate
            </button>
            <button
              onClick={() => setPanel(panel === 'report' ? null : 'report')}
              className="text-sm text-slate-500 font-semibold hover:text-red-600"
            >
              Report a mistake
            </button>
          </div>

          {panel && (
            <section className="card p-5 space-y-3">
              {panel === 'report' ? (
                <>
                  <p className="text-sm font-semibold text-slate-800">What&apos;s wrong with this lesson?</p>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    rows={3}
                    placeholder="e.g. The variance formula in section 2 should divide by n − 1"
                    aria-label="Describe the mistake"
                    className="input-base"
                  />
                  <button onClick={() => void report()} disabled={feedback.trim().length < 5} className="btn-secondary">
                    Send report
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-800">Regenerate this lesson</p>
                  {modePicker}
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    rows={2}
                    placeholder="What should change? (optional) e.g. more worked examples, simpler explanations"
                    aria-label="What should change"
                    className="input-base"
                  />
                  <p className="text-xs text-slate-400">Your current version is kept. You can switch back to it anytime.</p>
                  <button onClick={() => void generate(feedback)} disabled={generating} className="btn-primary">
                    {generating ? 'Writing…' : 'Generate new version'}
                  </button>
                </>
              )}
            </section>
          )}
        </>
      )}

      {resources && (
        <section className="card p-6">
          <h2 className="font-heading font-bold text-slate-900 mb-1">Watch &amp; read more</h2>
          {resources.videos.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {resources.videos.map(v => (
                <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="group rounded-xl border border-slate-200 overflow-hidden hover:border-violet-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumbnail} alt="" className="w-full aspect-video object-cover" loading="lazy" />
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-violet-600">{v.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{v.channel}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 mt-1">Find explainer videos and open course material on this topic:</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {resources.searches.map(s => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3 py-2">
                {s.label} ↗
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
