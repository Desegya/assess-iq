'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useApi } from '@/hooks/use-api'
import { SkeletonCard } from '@/components/ui/Skeleton'

interface NotesResponse {
  topic: { id: string; name: string; courseId: string; courseTitle: string }
  notes: string | null
  notesGeneratedAt: string | null
  groundedInMaterial?: boolean
}

export default function TopicNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()

  const [data, setData] = useState<NotesResponse | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<NotesResponse>(`/study/topics/${id}/notes`)
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load notes'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      setData(await api.post<NotesResponse>(`/study/topics/${id}/notes/generate`, {}))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes')
    } finally {
      setGenerating(false)
    }
  }

  if (!data && !error) return <div className="max-w-3xl"><SkeletonCard /></div>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        {data && (
          <Link href={`/courses/${data.topic.courseId}`} className="text-sm text-blue-600 font-semibold">
            ← Back to {data.topic.courseTitle}
          </Link>
        )}
        <h1 className="font-heading text-2xl font-bold text-slate-900 mt-2">{data?.topic.name ?? 'Notes'}</h1>
        <p className="text-slate-400 text-sm mt-1">Study notes</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {data && !data.notes && (
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500 mb-4">
            No notes for this topic yet. Nightklass can write them for you — from your uploaded material if you have
            any, or from what this topic usually covers at university level.
          </p>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? 'Writing your notes…' : 'Generate notes'}
          </button>
        </div>
      )}

      {data?.notes && (
        <>
          {data.groundedInMaterial === false && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              AI-generated from general knowledge, not your course material. Upload your notes or slides for content
              matched to your lecturer.
            </p>
          )}
          <article className="card p-6 text-sm text-slate-700 leading-relaxed">
            <ReactMarkdown
              components={{
                h1: props => <h2 className="font-heading text-xl font-bold text-slate-900 mt-6 mb-2 first:mt-0" {...props} />,
                h2: props => <h2 className="font-heading text-lg font-bold text-slate-900 mt-6 mb-2 first:mt-0" {...props} />,
                h3: props => <h3 className="font-semibold text-slate-900 mt-4 mb-1.5" {...props} />,
                p: props => <p className="mb-3" {...props} />,
                ul: props => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                ol: props => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                strong: props => <strong className="font-semibold text-slate-900" {...props} />,
                code: props => <code className="bg-slate-100 rounded px-1 py-0.5 text-[13px]" {...props} />,
              }}
            >
              {data.notes}
            </ReactMarkdown>
          </article>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/topics/${id}/quiz`} className="btn-primary">
              Quiz me on this
            </Link>
            <button onClick={handleGenerate} disabled={generating} className="btn-secondary">
              {generating ? 'Regenerating…' : 'Regenerate notes'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
