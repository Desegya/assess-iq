'use client'

import { useState, useEffect, useRef } from 'react'
import { DocumentUploader } from '@/components/documents/DocumentUploader'
import { useApi } from '@/hooks/use-api'

interface DocumentItem {
  id: string
  fileName: string
  fileType: 'PDF' | 'DOCX' | 'TXT'
  fileSizeBytes: number
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  pageCount?: number
  chunkCount?: number
  createdAt: string
  course?: { id: string; title: string } | null
  uploadedBy: { id: string; name: string }
}

const STATUS_BADGE: Record<DocumentItem['status'], { label: string; class: string }> = {
  UPLOADING:  { label: 'Uploading',  class: 'bg-sky-100 text-sky-700' },
  PROCESSING: { label: 'Processing', class: 'bg-amber-100 text-amber-700' },
  READY:      { label: 'Ready',      class: 'bg-emerald-100 text-emerald-700' },
  FAILED:     { label: 'Failed',     class: 'bg-red-100 text-red-700' },
}

const FILE_TYPE_COLOR: Record<string, string> = {
  PDF:  'bg-red-100 text-red-700',
  DOCX: 'bg-blue-100 text-blue-700',
  DOC:  'bg-blue-100 text-blue-700',
  TXT:  'bg-slate-100 text-slate-600',
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

export default function DocumentsPage() {
  const api = useApi()
  const [docs,         setDocs]         = useState<DocumentItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const [deleting,     setDeleting]     = useState<string | null>(null)

  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    void apiRef.current.get<DocumentItem[]>('/documents')
      .then(data => setDocs(data))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  function onUploaded(doc: DocumentItem) {
    setDocs(prev => [doc, ...prev])
    setShowUploader(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    setDeleting(id)
    try {
      await api.del(`/documents/${id}`)
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch {
      // silently ignore
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload lecture notes — AI will extract text and generate questions from them.
          </p>
        </div>
        <button
          onClick={() => setShowUploader(v => !v)}
          className={`font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-150
                      shadow-sm flex items-center gap-2 active:scale-[0.98] ${
            showUploader
              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          {showUploader ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload document
            </>
          )}
        </button>
      </div>

      {/* ── Uploader panel ── */}
      {showUploader && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6 animate-slide-up">
          <h2 className="font-heading font-semibold text-slate-800 mb-4">Upload a new document</h2>
          <DocumentUploader onSuccess={d => onUploaded(d as DocumentItem)} />
        </div>
      )}

      {/* ── Document list ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-heading font-semibold text-slate-700 text-lg">No documents yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Upload a PDF, DOCX, or TXT file. AI will extract the text and let you generate questions from it.
          </p>
          <button
            onClick={() => setShowUploader(true)}
            className="mt-5 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white
                       font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm"
          >
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {docs.map(doc => {
              const badge = STATUS_BADGE[doc.status]
              const fileExt = doc.fileType || doc.fileName.split('.').pop()?.toUpperCase() || 'FILE'
              return (
                <div key={doc.id}
                     className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/60 transition-colors group">
                  {/* File type badge */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                                  text-xs font-bold flex-shrink-0 ${
                    FILE_TYPE_COLOR[fileExt] ?? 'bg-slate-100 text-slate-600'
                  }`}>
                    {fileExt}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      {doc.course && <span className="text-violet-600 font-medium">{doc.course.title}</span>}
                      {doc.chunkCount != null && <span>{doc.chunkCount} chunks</span>}
                    </div>
                  </div>

                  {/* Status */}
                  <span className={`flex-shrink-0 inline-flex px-2.5 py-1 rounded-full
                                   text-xs font-semibold ${badge.class}`}>
                    {badge.label}
                  </span>

                  {/* Size */}
                  <span className="text-xs text-slate-400 flex-shrink-0 w-14 text-right">
                    {formatBytes(doc.fileSizeBytes)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {doc.status === 'READY' && (
                      <a
                        href={`/teacher/questions/generate?documentId=${doc.id}`}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-700
                                   transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Generate questions
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40
                                 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {deleting === doc.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
