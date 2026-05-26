'use client'

import { useState, useRef } from 'react'
import { useApi } from '@/hooks/use-api'

interface UploadedDoc {
  id: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  status: string
  pageCount?: number
  chunkCount?: number
}

interface Props {
  courseId?: string
  onSuccess?: (doc: UploadedDoc) => void
}

const ACCEPT = '.pdf,.docx,.doc,.txt'
const MAX_MB = 20

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUploader({ courseId, onSuccess }: Props) {
  const api      = useApi()
  const inputRef = useRef<HTMLInputElement>(null)

  const [dragging,  setDragging]  = useState(false)
  const [file,      setFile]      = useState<File | null>(null)
  const [progress,  setProgress]  = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [error,     setError]     = useState<string | null>(null)

  function pickFile(f: File) {
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_MB} MB)`)
      return
    }
    setFile(f); setError(null); setProgress('idle')
  }

  function onInputChange(e: { target: HTMLInputElement }) {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setProgress('uploading'); setError(null)

    try {
      const form = new FormData()
      form.append('file', file)
      if (courseId) form.append('courseId', courseId)

      setProgress('processing')
      const doc = await api.upload<UploadedDoc>('/documents/upload', form)
      setProgress('done')
      onSuccess?.(doc)
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setProgress('error')
    }
  }

  // File type icon
  const ext = file?.name.split('.').pop()?.toUpperCase() ?? ''
  const extColor: Record<string, string> = {
    PDF: 'bg-red-100 text-red-700', DOCX: 'bg-blue-100 text-blue-700',
    DOC: 'bg-blue-100 text-blue-700', TXT: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200 ${
          dragging
            ? 'border-violet-400 bg-violet-50 scale-[1.01]'
            : file
            ? 'border-violet-300 bg-violet-50/50'
            : 'border-slate-300 hover:border-violet-300 hover:bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onInputChange}
        />

        {file ? (
          <div className="flex items-center justify-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                            text-sm font-bold flex-shrink-0 ${extColor[ext] ?? 'bg-slate-100 text-slate-600'}`}>
              {ext || 'FILE'}
            </div>
            <div className="text-left min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate max-w-48">{file.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setFile(null); setProgress('idle') }}
              className="w-6 h-6 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-600
                         flex items-center justify-center text-slate-500 flex-shrink-0 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center
                            mx-auto mb-3">
              <svg className="w-7 h-7 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Drop a file here or{' '}
              <span className="text-violet-600">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF, DOCX, or TXT — up to {MAX_MB} MB</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Processing status */}
      {(progress === 'uploading' || progress === 'processing') && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200
                        rounded-xl px-4 py-3">
          <svg className="animate-spin h-4 w-4 text-violet-600 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-sm text-violet-700 font-medium">
            {progress === 'uploading' ? 'Uploading…' : 'Extracting text…'}
          </span>
        </div>
      )}

      {progress === 'done' && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200
                        rounded-xl px-4 py-3">
          <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-emerald-700 font-semibold">
            Document processed and ready for AI question generation
          </span>
        </div>
      )}

      {/* Upload button */}
      {file && progress !== 'uploading' && progress !== 'processing' && (
        <button
          onClick={handleUpload}
          className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white
                     font-semibold py-3 rounded-xl text-sm transition-all duration-150 shadow-sm"
        >
          Upload &amp; Extract Text
        </button>
      )}
    </div>
  )
}
