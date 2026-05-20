'use client'

import { useState, useEffect, useCallback } from 'react'
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
  UPLOADING:   { label: 'Uploading',   class: 'bg-blue-100 text-blue-700' },
  PROCESSING:  { label: 'Processing',  class: 'bg-amber-100 text-amber-700' },
  READY:       { label: 'Ready',       class: 'bg-emerald-100 text-emerald-700' },
  FAILED:      { label: 'Failed',      class: 'bg-red-100 text-red-700' },
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const api = useApi()
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadDocs = useCallback(async () => {
    try {
      const data = await api.get<DocumentItem[]>('/documents')
      setDocs(data)
    } catch {
      // silently ignore on first load errors
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { void loadDocs() }, [loadDocs])

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
      alert('Failed to delete document')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Upload lecture notes — AI will extract text and generate questions from them.
          </p>
        </div>
        <button
          onClick={() => setShowUploader(v => !v)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
                     px-4 py-2 rounded-lg transition-colors"
        >
          {showUploader ? 'Cancel' : '+ Upload document'}
        </button>
      </div>

      {/* Uploader panel */}
      {showUploader && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Upload a new document</h2>
          <DocumentUploader onSuccess={d => onUploaded(d as DocumentItem)} />
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500 font-medium">No documents yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Upload a PDF or DOCX to get started
          </p>
          <button
            onClick={() => setShowUploader(true)}
            className="mt-4 text-sm font-medium text-indigo-600 hover:underline"
          >
            Upload your first document →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Course</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chunks</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map(doc => {
                const badge = STATUS_BADGE[doc.status]
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-xs">{doc.fileName}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {doc.course?.title ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.class}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatBytes(doc.fileSizeBytes)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {doc.chunkCount != null ? doc.chunkCount : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {doc.status === 'READY' && (
                        <a
                          href={`/teacher/questions/generate?documentId=${doc.id}`}
                          className="text-indigo-600 hover:underline text-xs font-medium mr-3"
                        >
                          Generate questions
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deleting === doc.id}
                        className="text-red-500 hover:text-red-700 text-xs disabled:opacity-40"
                      >
                        {deleting === doc.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
