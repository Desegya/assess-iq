'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ProposalSet, TopicProposal } from './outline-types'

const NOTE: Partial<Record<ProposalSet['source'], string>> = {
  AI_SUGGESTED:
    'Suggested from how this course is usually taught, not your official course outline. Edit or remove anything that doesn’t match before adding.',
  OUTLINE: 'Pulled from your course outline. Check the topics match before adding. Your original outline is kept as-is.',
  MATERIAL: 'Pulled from your notes. Edit or remove anything that isn’t a real topic before adding.',
}

export function ProposalReview({
  courseId,
  set,
  onSaved,
  onCancel,
}: {
  courseId: string
  set: ProposalSet
  onSaved: () => void
  onCancel: () => void
}) {
  const api = useApi()
  const [proposals, setProposals] = useState<TopicProposal[]>(set.proposals)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(i: number, patch: Partial<TopicProposal>) {
    setProposals(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  function removeSubtopic(i: number, j: number) {
    update(i, { subtopics: proposals[i]!.subtopics?.filter((_, k) => k !== j) })
  }

  async function handleSave() {
    const topics = proposals
      .filter(p => p.name.trim())
      .map(p => ({
        name: p.name.trim(),
        description: p.description,
        subtopics: (p.subtopics ?? []).filter(s => s.trim()).map(s => ({ name: s.trim() })),
      }))
    if (topics.length === 0) return
    setError(null)
    setSaving(true)
    try {
      await api.post(`/courses/${courseId}/topics/bulk`, { source: set.source, topics })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save topics')
      setSaving(false)
    }
  }

  const subtopicCount = proposals.reduce((n, p) => n + (p.subtopics?.length ?? 0), 0)

  return (
    <div className="space-y-3">
      {set.fallback ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          AI isn&apos;t available right now, so we split the text into sections. Edit these before adding.
        </p>
      ) : (
        NOTE[set.source] && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{NOTE[set.source]}</p>
        )
      )}
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <ol className="space-y-2">
        {proposals.map((p, i) => (
          <li key={i} className="bg-slate-50 rounded-xl px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 w-5 text-right flex-shrink-0">{i + 1}.</span>
              <input
                value={p.name}
                onChange={e => update(i, { name: e.target.value })}
                aria-label={`Topic ${i + 1} name`}
                className="input-base min-w-0 flex-1 !py-1.5"
              />
              <button
                onClick={() => setProposals(prev => prev.filter((_, idx) => idx !== i))}
                className="text-xs text-red-500 flex-shrink-0"
              >
                Remove
              </button>
            </div>
            {p.subtopics && p.subtopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                {p.subtopics.map((s, j) => (
                  <span key={j} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-slate-600">
                    {s}
                    <button
                      onClick={() => removeSubtopic(i, j)}
                      aria-label={`Remove subtopic ${s}`}
                      className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-500 leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={handleSave} disabled={saving || proposals.length === 0} className="btn-primary">
          {saving
            ? 'Adding…'
            : `Add ${proposals.length} topic${proposals.length === 1 ? '' : 's'}${subtopicCount ? ` + ${subtopicCount} subtopics` : ''}`}
        </button>
        <button onClick={onCancel} disabled={saving} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  )
}
