'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'

interface Settings {
  showResultsImmediately?: boolean
  allowReview?: boolean
  resultsReleasedAt?: string | null
}
type Visibility = 'HIDDEN' | 'SCORE' | 'FULL'

/** When students see their result, and how much of it. Editable at any time, even after publishing. */
export function ResultSettingsCard({
  assessmentId,
  settings: initial,
  onChange,
}: {
  assessmentId: string
  settings: Settings | null | undefined
  onChange?: (settings: Settings) => void
}) {
  const api = useApi()
  const [settings, setSettings] = useState<Settings>(initial ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const immediate = settings.showResultsImmediately !== false
  const released = immediate || !!settings.resultsReleasedAt
  const corrections = settings.allowReview !== false

  async function save(body: { showResultsImmediately?: boolean; released?: boolean; allowReview?: boolean }) {
    setSaving(true)
    setError(null)
    try {
      const res = await api.patch<{ settings: Settings; resultVisibility: Visibility }>(`/assessments/${assessmentId}/result-settings`, body)
      setSettings(res.settings)
      onChange?.(res.settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const option = (active: boolean, label: string, help: string, onSelect: () => void) => (
    <label className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${active ? 'border-violet-300 bg-violet-50' : 'border-slate-200'}`}>
      <input type="radio" checked={active} onChange={onSelect} disabled={saving} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{help}</span>
      </span>
    </label>
  )

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="product-section-title">Results for students</h2>
          <p className="mt-1 text-sm text-slate-500">You can change these at any time, even after students have submitted.</p>
        </div>
        <span
          className={`badge shrink-0 ${released ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
          role="status"
        >
          {released ? (corrections ? 'Students see score and corrections' : 'Students see their score') : 'Results hidden from students'}
        </span>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-slate-700">When</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {option(immediate, 'As soon as they submit', 'Each student sees their result straight away.', () => void save({ showResultsImmediately: true }))}
          {option(!immediate, 'When I release them', 'Students see “submitted” until you release results.', () => void save({ showResultsImmediately: false }))}
        </div>
        {!immediate && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {settings.resultsReleasedAt ? (
              <>
                <p className="text-sm text-slate-600">Released {new Date(settings.resultsReleasedAt).toLocaleString()}.</p>
                <button className="btn-secondary !min-h-10 !py-2" disabled={saving} onClick={() => void save({ released: false })}>
                  Hide results again
                </button>
              </>
            ) : (
              <button className="btn-primary !min-h-10 !py-2" disabled={saving} onClick={() => void save({ released: true })}>
                Release results now
              </button>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-slate-700">What they see</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {option(!corrections, 'Score only', 'Their mark and percentage, without the answers.', () => void save({ allowReview: false }))}
          {option(corrections, 'Score with corrections', 'Each question marked right or wrong, with the correct answers.', () => void save({ allowReview: true }))}
        </div>
      </fieldset>
    </section>
  )
}
