'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ProposalSet, TopicProposal } from './outline-types'

type Mode = 'upload' | 'paste' | 'photo'

interface ProposalResponse {
  source: 'ai' | 'fallback'
  proposals: TopicProposal[]
}

// Every way to give a course its outline: AI from the title, a file, pasted text, or a photo (spec §10)
export function OutlineInput({
  courseId,
  hasTopics,
  onProposals,
}: {
  courseId: string
  hasTopics: boolean
  onProposals: (set: ProposalSet) => void
}) {
  const api = useApi()
  const [mode, setMode] = useState<Mode | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(label: string, fn: () => Promise<ProposalSet>) {
    setError(null)
    setBusy(label)
    try {
      onProposals(await fn())
      setMode(null)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  const fromOutline = (r: ProposalResponse): ProposalSet => ({
    source: 'OUTLINE',
    proposals: r.proposals,
    fallback: r.source === 'fallback',
  })

  function handleGenerate() {
    void run('Drafting an outline…', async () => {
      const r = await api.post<ProposalResponse>(`/study/courses/${courseId}/topics/suggest`, {})
      return { source: 'AI_SUGGESTED', proposals: r.proposals }
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('Reading your outline…', async () => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('courseId', courseId)
      const doc = await api.upload<{ id: string; status: string }>('/documents/upload', formData)
      if (doc.status !== 'READY') throw new Error("We couldn't read that file. Try another, paste the text, or take a photo.")
      return fromOutline(await api.post<ProposalResponse>(`/study/courses/${courseId}/outline/document/${doc.id}`, {}))
    })
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('Reading your photo…', async () => {
      const formData = new FormData()
      formData.append('file', file)
      return fromOutline(await api.upload<ProposalResponse>(`/study/courses/${courseId}/outline/photo`, formData))
    })
  }

  function handlePaste(e: React.FormEvent) {
    e.preventDefault()
    void run('Finding topics…', async () =>
      fromOutline(await api.post<ProposalResponse>(`/study/courses/${courseId}/outline/text`, { text })),
    )
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(mode === m ? null : m)}
      disabled={!!busy}
      className={`text-sm font-semibold rounded-xl px-3.5 py-2 transition-colors ${
        mode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">
        {hasTopics
          ? 'Add more topics from another source:'
          : 'No outline yet? Generate one from the course title, or bring your own:'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleGenerate} disabled={!!busy} className="btn-primary !py-2 !px-3.5 text-sm">
          ✨ Generate with AI
        </button>
        {tab('upload', 'Upload file')}
        {tab('paste', 'Paste text')}
        {tab('photo', 'Take a photo')}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mt-3">{error}</div>}
      {busy && <p className="text-sm text-slate-400 mt-3">{busy}</p>}

      {!busy && mode === 'upload' && (
        <div className="mt-3">
          <input type="file" accept=".pdf,.doc,.docx,.pptx,.txt" onChange={handleFile} className="text-sm" aria-label="Course outline file" />
          <p className="text-xs text-slate-400 mt-1.5">PDF, Word, PowerPoint or text.</p>
        </div>
      )}

      {!busy && mode === 'photo' && (
        <div className="mt-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handlePhoto}
            className="text-sm"
            aria-label="Photo of your course outline"
          />
          <p className="text-xs text-slate-400 mt-1.5">Photograph your syllabus or a prospectus page. Flat, well-lit and in focus works best.</p>
        </div>
      )}

      {!busy && mode === 'paste' && (
        <form onSubmit={handlePaste} className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            required
            minLength={20}
            placeholder="Paste your course outline here: weeks, modules or topics…"
            aria-label="Course outline text"
            className="input-base"
          />
          <button type="submit" className="btn-secondary">
            Find topics
          </button>
        </form>
      )}
    </div>
  )
}
