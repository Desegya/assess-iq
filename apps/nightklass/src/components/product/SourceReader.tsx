'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useApi } from '@/hooks/use-api'
import { ReadingText } from './ReadingText'

export interface LessonSource {
  marker: string
  documentName: string
  documentId?: string | null
  excerpt: string | null
}

export function SourceReader({
  source,
  onClose,
  returnFocusId,
}: {
  source: LessonSource
  onClose: () => void
  returnFocusId: string
}) {
  const api = useApi()
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const title = useId()
  const [size, setSize] = useState('18')
  const [view, setView] = useState<'passage' | 'document'>('passage')
  const [fullText, setFullText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const reader = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (reader && !reader.open) reader.showModal()
    return () => {
      document.body.style.overflow = previousOverflow
      requestAnimationFrame(() => {
        document.getElementById(returnFocusId)?.focus()
      })
    }
    // This reader is remounted for each reference; the trigger ID stays stable across lesson renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function showDocument() {
    setView('document')
    setError('')
    body.current?.scrollTo(0, 0)
    if (fullText !== null || !source.documentId) return
    setLoading(true)
    try {
      const document = await api.get<{ extractedText: string | null }>(
        `/documents/${encodeURIComponent(source.documentId)}`,
      )
      setFullText(document.extractedText || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load these notes. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}
      className="source-reader m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-white p-0 text-slate-800 sm:m-auto sm:h-[min(85dvh,900px)] sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:rounded-2xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 space-y-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Reference {source.marker}
              </p>
              <h2 id={title} className="break-words text-lg font-semibold leading-snug">
                {source.documentName}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close reference reader"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl hover:bg-slate-50"
            >
              ×
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" aria-label="Reference view">
              <button
                type="button"
                aria-pressed={view === 'passage'}
                onClick={() => {
                  setView('passage')
                  body.current?.scrollTo(0, 0)
                }}
                className={`min-h-11 rounded-xl px-3 text-sm font-medium ${view === 'passage' ? 'bg-violet-100 text-violet-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Cited passage
              </button>
              {source.documentId && (
                <button
                  type="button"
                  aria-pressed={view === 'document'}
                  onClick={() => void showDocument()}
                  disabled={loading}
                  className={`min-h-11 rounded-xl px-3 text-sm font-medium ${view === 'document' ? 'bg-violet-100 text-violet-800' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Full document text
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Text size
              <select
                aria-label="Text size"
                value={size}
                onChange={(event) => setSize(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-2"
              >
                <option value="16">Standard</option>
                <option value="18">Comfortable</option>
                <option value="21">Large</option>
              </select>
            </label>
          </div>
        </header>
        <div
          ref={body}
          tabIndex={0}
          aria-label="Reference text"
          aria-busy={loading && view === 'document'}
          style={{ '--reading-font-size': `${size}px` } as CSSProperties}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8"
        >
          {view === 'passage' ? (
            source.excerpt ? (
              <ReadingText>{source.excerpt}</ReadingText>
            ) : (
              <p className="text-base leading-relaxed text-slate-600">
                This source has been removed. Its passage is no longer available.
              </p>
            )
          ) : loading ? (
            <p role="status">Loading your notes…</p>
          ) : error ? (
            <div role="alert" className="space-y-3 text-base text-red-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void showDocument()}
                className="min-h-11 underline"
              >
                Try again
              </button>
            </div>
          ) : fullText ? (
            <ReadingText>{fullText}</ReadingText>
          ) : (
            <p className="text-base leading-relaxed text-slate-600">
              There is no readable text available for this file. You can still return to the cited
              passage.
            </p>
          )}
        </div>
        <footer className="shrink-0 border-t border-slate-200 px-5 py-3 text-sm leading-relaxed text-slate-500 sm:px-8">
          {view === 'passage'
            ? 'The passage used for this lesson, kept in its original wording.'
            : 'Text from your uploaded file. Figures and original page layout may not appear here.'}
        </footer>
      </div>
    </dialog>
  )
}
