'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useApi } from '@/hooks/use-api'

/** Classes that check school emails need a confirmed address; remind until it is. */
export function EmailConfirmationBanner() {
  const { user, refreshAccessToken } = useAuth()
  const api = useApi()
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!user || user.emailVerifiedAt) return null

  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 sm:flex-row sm:items-center">
      <p className="flex-1">
        <span className="font-semibold">Confirm your email.</span> We sent a link to {user.email}. Most classes need a
        confirmed email before you can join.
        {note && <span className="mt-1 block text-amber-800">{note}</span>}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          className="btn-secondary !min-h-10 !py-2"
          onClick={async () => {
            setBusy(true)
            const res = await api.post<{ message: string }>('/auth/verify-email/resend', { app: 'kwikeval' }).catch(() => null)
            setNote(res?.message ?? 'Could not send right now. Try again in a minute.')
            setBusy(false)
          }}
        >
          Send again
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-secondary !min-h-10 !py-2"
          onClick={async () => {
            setBusy(true)
            await refreshAccessToken()
            setBusy(false)
          }}
        >
          I&rsquo;ve confirmed it
        </button>
      </div>
    </div>
  )
}
