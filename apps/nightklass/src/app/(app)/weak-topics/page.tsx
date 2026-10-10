'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { useApi } from '@/hooks/use-api'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

interface WeakTopic {
  id: string
  masteryScore: number
  quizAverage: number | null
  topic: { id: string; name: string; courseId: string }
}

function severityColor(pct: number) {
  if (pct < 40) return { bar: 'bg-red-500', text: 'text-red-600' }
  if (pct < 70) return { bar: 'bg-amber-500', text: 'text-amber-600' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600' }
}

export default function WeakTopicsPage() {
  const api = useApi()
  const [items, setItems] = useState<WeakTopic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cardsBusy, setCardsBusy] = useState<string | null>(null)
  const [cardsDone, setCardsDone] = useState<Record<string, number>>({})

  async function makeFlashcards(topicId: string) {
    setCardsBusy(topicId)
    try {
      const cards = await api.post<unknown[]>(`/study/topics/${topicId}/flashcards/generate`, {
        count: 8,
      })
      setCardsDone((d) => ({ ...d, [topicId]: cards.length }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make flashcards')
    } finally {
      setCardsBusy(null)
    }
  }

  useEffect(() => {
    api
      .get<WeakTopic[]>('/study/topics/weak')
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load weak topics'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <PageHeader
        title="A little more practice"
        description="Topics where your quiz scores are below 60%. Revise the lesson, then quiz yourself again. Your plan adds revision sessions for these automatically."
        eyebrow="Revision"
        icon="target"
      />

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
        >
          {error}
        </div>
      )}

      {items === null && !error && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {items?.length === 0 && (
        <EmptyState
          illustration="search"
          title="No weak topics yet"
          subtitle="Take a self-quiz on a topic to start tracking your mastery."
        />
      )}

      <div className="space-y-3">
        {items?.map((item) => {
          const pct = item.quizAverage ?? item.masteryScore
          const color = severityColor(pct)
          return (
            <div
              key={item.id}
              className="card p-5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{item.topic.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden max-w-[160px]">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${color.bar}`}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${color.text}`}>
                    {item.quizAverage ?? '—'}%
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Link href={`/topics/${item.topic.id}/learn`} className="btn-primary !py-2 text-sm">
                  <Icon name="book" />
                  Revise lesson
                </Link>
                <Link
                  href={`/topics/${item.topic.id}/quiz`}
                  className="btn-secondary !py-2 text-sm"
                >
                  <Icon name="target" />
                  Quiz again
                </Link>
                {cardsDone[item.topic.id] !== undefined ? (
                  <Link href="/flashcards" className="text-xs font-semibold text-emerald-700">
                    ✓ {cardsDone[item.topic.id]} flashcards
                  </Link>
                ) : (
                  <button
                    onClick={() => void makeFlashcards(item.topic.id)}
                    disabled={cardsBusy === item.topic.id}
                    className="text-xs font-semibold text-violet-600 disabled:opacity-60"
                  >
                    {cardsBusy === item.topic.id ? 'Making…' : 'Make flashcards'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
