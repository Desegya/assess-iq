'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

interface CourseDocument {
  id: string
  fileName: string
  status: string
  createdAt: string
}

export function CourseDocuments({ courseId, version }: { courseId: string; version: number }) {
  const api = useApi()
  const [documents, setDocuments] = useState<CourseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [opening, setOpening] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .get<CourseDocument[]>(`/documents?courseId=${encodeURIComponent(courseId)}`)
      .then((items) => {
        if (active) setDocuments(items)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load uploaded notes.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [api, courseId, version, retry])

  async function openDocument(document: CourseDocument) {
    setOpening(document.id)
    setOpenError(null)
    // Open synchronously so browsers allow the new tab while the signed URL loads.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const { url } = await api.get<{ url: string }>(`/documents/${document.id}/download-url`)
      if (tab) tab.location.href = url
      else window.location.assign(url)
    } catch (err) {
      tab?.close()
      setOpenError(err instanceof Error ? err.message : 'Could not open this file.')
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="mb-5" aria-label="Uploaded course materials">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">
        Uploaded files{!loading && !error ? ` (${documents.length})` : ''}
      </h3>
      {loading ? (
        <p role="status" className="text-sm text-slate-500">
          Loading uploaded files…
        </p>
      ) : error ? (
        <div role="alert" className="text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            className="underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-slate-500">No files uploaded for this course yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-slate-900">
                  {document.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  {document.status === 'READY'
                    ? 'Ready'
                    : document.status === 'FAILED'
                      ? 'Could not read file'
                      : 'Processing'}
                  {' · Uploaded '}
                  {new Date(document.createdAt).toLocaleDateString()}
                </p>
              </div>
              {document.status === 'READY' && (
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold text-violet-700 disabled:opacity-50"
                  disabled={opening !== null}
                  onClick={() => void openDocument(document)}
                  aria-label={`Open ${document.fileName}`}
                >
                  {opening === document.id ? 'Opening…' : 'Open file'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {openError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {openError}
        </p>
      )}
    </div>
  )
}
