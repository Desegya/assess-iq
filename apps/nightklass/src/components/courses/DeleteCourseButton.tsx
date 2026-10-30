'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'

export function DeleteCourseButton({
  course,
  onDeleted,
}: {
  course: { id: string; title: string }
  onDeleted: () => void
}) {
  const api = useApi()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove() {
    if (
      !window.confirm(
        `Delete ${course.title}? Its topics, lessons and study history will be removed. This cannot be undone. You can add a different course afterwards.`,
      )
    )
      return
    setBusy(true)
    setError('')
    try {
      await api.del(`/courses/${course.id}`)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this course')
      setBusy(false)
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        aria-label={`Delete ${course.title}`}
        className="min-h-11 text-sm font-medium text-red-700 underline-offset-4 hover:underline disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete course'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
