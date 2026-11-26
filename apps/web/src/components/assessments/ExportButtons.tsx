'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'

const FORMATS = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'csv', label: 'CSV' },
  { format: 'pdf', label: 'PDF' },
] as const

/** Download results in each format. `path` is the export endpoint without ?format. */
export function ExportButtons({ path, label = 'Export results' }: { path: string; label?: string }) {
  const api = useApi()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{label}:</span>
        {FORMATS.map(f => (
          <button
            key={f.format}
            className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(f.format)
              setError(null)
              try {
                await api.download(`${path}?format=${f.format}`, `results.${f.format}`)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Download failed')
              } finally {
                setBusy(null)
              }
            }}
          >
            {busy === f.format ? 'Preparing…' : f.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
