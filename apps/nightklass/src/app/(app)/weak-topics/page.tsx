'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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

  useEffect(() => {
    api
      .get<WeakTopic[]>('/study/topics/weak')
      .then(setItems)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load weak topics'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-slate-900 mb-1">Weak topics</h1>
      <p className="text-slate-500 text-sm mb-6">Topics where your quiz scores suggest you need more revision.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {items === null && !error && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {items?.length === 0 && (
        <EmptyState illustration="search" title="No weak topics yet" subtitle="Take a self-quiz on a topic to start tracking your mastery." />
      )}

      <div className="space-y-3">
        {items?.map(item => {
          const pct = item.quizAverage ?? item.masteryScore
          const color = severityColor(pct)
          return (
            <div key={item.id} className="card p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{item.topic.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden max-w-[160px]">
                    <div className={`h-full rounded-full transition-all duration-700 ${color.bar}`} style={{ width: `${Math.max(4, pct)}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${color.text}`}>{item.quizAverage ?? '—'}%</span>
                </div>
              </div>
              <Link href={`/topics/${item.topic.id}/quiz`} className="btn-secondary flex-shrink-0">
                Practice again
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
