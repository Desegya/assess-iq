'use client'

import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { Notice } from '@/components/auth/FormParts'

interface Platform {
  lecturers: number
  students: number
  classes: number
  assessments: number
  attempts: number
  aiTokens: number
  aiCostUsd: number
}

export default function AdminDashboardPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api
  const [data, setData] = useState<Platform | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRef.current
      .get<Platform>('/analytics/platform')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load platform totals'))
  }, [])

  const tiles = data
    ? [
        { label: 'Lecturers', value: data.lecturers.toLocaleString() },
        { label: 'Students in classes', value: data.students.toLocaleString() },
        { label: 'Classes', value: data.classes.toLocaleString() },
        { label: 'Tests published', value: data.assessments.toLocaleString() },
        { label: 'Tests submitted', value: data.attempts.toLocaleString() },
        { label: 'AI tokens used', value: data.aiTokens.toLocaleString() },
        { label: 'AI spend', value: `$${data.aiCostUsd.toFixed(2)}` },
      ]
    : []

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Platform overview</h1>
        <p className="mt-1 text-sm text-slate-500">KwikEval totals across every lecturer.</p>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {!data && !error && <p role="status" className="text-sm text-slate-500">Loading…</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(t => (
          <div key={t.label} className="card p-5">
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{t.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
