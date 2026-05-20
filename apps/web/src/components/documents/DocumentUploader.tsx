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
  const api = useApi()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  function pickFile(f: File) {
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_MB} MB)`)
      return
    }
    setFile(f)
    setError(null)
    setProgress('idle')
  }

  function onInputChange(e: { target: HTMLInputElement }) {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setProgress('uploading')
    setError(null)

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

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onInputChange}
        />

        <svg
          className="mx-auto h-10 w-10 text-gray-400 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        {file ? (
          <div>
            <p className="font-medium text-gray-800 text-sm">{file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatBytes(file.size)}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drop a file here or <span className="text-indigo-600">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, or TXT — up to {MAX_MB} MB</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Status */}
      {(progress === 'uploading' || progress === 'processing') && (
        <div className="flex items-center gap-2 text-sm text-indigo-600">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          {progress === 'uploading' ? 'Uploading…' : 'Extracting text…'}
        </div>
      )}

      {progress === 'done' && (
        <p className="text-sm text-emerald-600 font-medium">
          ✓ Document processed and ready for AI question generation
        </p>
      )}

      {/* Upload button */}
      {file && progress !== 'uploading' && progress !== 'processing' && (
        <button
          onClick={handleUpload}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium
                     py-2.5 rounded-lg text-sm transition-colors"
        >
          Upload &amp; Extract Text
        </button>
      )}
    </div>
  )
}
