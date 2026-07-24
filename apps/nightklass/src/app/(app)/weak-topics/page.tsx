'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'

interface WeakTopic {
  id: string
  masteryScore: number
  quizAverage: number | null
  topic: { id: string; name: string; courseId: string }
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

      {items?.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-slate-600 font-medium">No weak topics yet</p>
          <p className="text-slate-400 text-sm mt-1">Take a self-quiz on a topic to start tracking your mastery.</p>
        </div>
      )}

      <div className="space-y-3">
        {items?.map(item => (
          <div key={item.id} className="card p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{item.topic.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">Quiz average: {item.quizAverage ?? '—'}%</p>
            </div>
            <Link href={`/topics/${item.topic.id}/quiz`} className="btn-secondary">
              Practice again
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
