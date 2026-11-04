'use client'

import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/hooks/use-api'

interface CourseDocument {
  id: string
  fileName: string
  status: string
  createdAt: string
  materialReviewStatus?: string
  materialReviewReason?: string | null
}

export function CourseDocuments({
  courseId,
  version,
  uploadsBusy = false,
  onApproved,
  onRemoved,
}: {
  courseId: string
  version: number
  uploadsBusy?: boolean
  onApproved?: (id: string) => void
  onRemoved?: (id: string) => void
}) {
  const api = useApi()
  const [documents, setDocuments] = useState<CourseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [opening, setOpening] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null)
  const actionErrorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (actionError) actionErrorRef.current?.focus()
  }, [actionError])

  async function reviewDocument(document: CourseDocument, action: 'approve' | 'remove') {
    if (
      action === 'remove' &&
      !window.confirm(
        `Remove "${document.fileName}" from this course? This deletes the uploaded file.`,
      )
    )
      return
    setActing(document.id)
    setActionError(null)
    try {
      if (action === 'approve') {
        await api.post(`/documents/${document.id}/approve-course-material`, {})
        setDocuments((current) =>
          current.map((doc) =>
            doc.id === document.id ? { ...doc, materialReviewStatus: 'APPROVED' } : doc,
          ),
        )
        onApproved?.(document.id)
      } else {
        await api.del(`/documents/${document.id}`)
        setDocuments((current) => current.filter((doc) => doc.id !== document.id))
        onRemoved?.(document.id)
      }
    } catch (err) {
      setActionError({
        id: document.id,
        message: err instanceof Error ? err.message : 'Could not update this file. Try again.',
      })
    } finally {
      setActing(null)
    }
  }

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
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-slate-900">
                  {document.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  {document.status === 'READY'
                    ? document.materialReviewStatus && document.materialReviewStatus !== 'APPROVED'
                      ? 'Needs course review'
                      : 'Ready'
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
              <button
                type="button"
                disabled={acting !== null || uploadsBusy}
                onClick={() => void reviewDocument(document, 'remove')}
                aria-label={`Remove ${document.fileName}`}
                className="text-xs font-semibold text-red-700"
              >
                Remove
              </button>
              {document.materialReviewStatus && document.materialReviewStatus !== 'APPROVED' && (
                <div
                  id={`material-review-${document.id}`}
                  tabIndex={-1}
                  role="alert"
                  aria-label={`Review ${document.fileName}`}
                  className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <p className="font-semibold">Check this file’s course before using it</p>
                  <p className="mt-1">
                    {document.materialReviewReason ??
                      'We could not confidently match this file to this course.'}
                  </p>
                  <p className="mt-1">
                    It is saved, but excluded from lessons, quizzes and course answers until you
                    confirm it belongs here. This automatic check can be mistaken.
                  </p>
                  {document.status === 'READY' && (
                    <button
                      type="button"
                      disabled={acting !== null || uploadsBusy}
                      onClick={() => void reviewDocument(document, 'approve')}
                      aria-label={`Use ${document.fileName} for this course`}
                      className="mt-2 font-semibold underline"
                    >
                      {acting === document.id
                        ? 'Saving…'
                        : 'This belongs here — use for this course'}
                    </button>
                  )}
                </div>
              )}
              {actionError?.id === document.id && (
                <p
                  role="alert"
                  tabIndex={-1}
                  ref={actionErrorRef}
                  className="w-full text-sm text-red-700"
                >
                  {actionError.message}
                </p>
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
