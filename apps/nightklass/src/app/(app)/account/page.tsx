'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'

interface Me {
  email: string
  emailVerifiedAt: string | null
  organizationId: string | null
}

export default function AccountPage() {
  const api = useApi()
  const { logout } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    api.get<Me>('/auth/me').then(setMe).catch((err: Error) => setError(err.message))
  }, [api])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const managed = !!me?.organizationId
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Account &amp; privacy</h1>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Email</h2>
        <p className="text-sm">
          {me?.email}{' '}
          {me && (me.emailVerifiedAt ? <span className="text-emerald-700">· confirmed</span> : <span className="text-amber-700">· not confirmed</span>)}
        </p>
        {me && !me.emailVerifiedAt && (
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => run(async () => setMessage((await api.post<{ message: string }>('/auth/verify-email/resend', {})).message))}
          >
            Send confirmation email
          </button>
        )}
        <p className="text-xs text-slate-500">A confirmed email lets you reset your password if you forget it.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Download my data</h2>
        <p className="text-sm text-slate-600">
          A JSON file with your profile, courses, practice, mocks, plans and other records. Read the{' '}
          <Link href="/privacy" className="text-violet-700 underline">
            privacy notice
          </Link>{' '}
          for what we keep and why.
        </p>
        <button
          className="btn-secondary"
          disabled={busy || managed}
          onClick={() =>
            run(async () => {
              const data = await api.get<unknown>('/users/me/export')
              const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
              const link = document.createElement('a')
              link.href = url
              link.download = `nightklass-data-${new Date().toISOString().slice(0, 10)}.json`
              link.click()
              URL.revokeObjectURL(url)
              setMessage('Your data file has been downloaded.')
            })
          }
        >
          Download my data
        </button>
      </section>

      <section className="card space-y-3 border-red-200 p-5">
        <h2 className="font-semibold text-red-700">Delete my account</h2>
        {managed ? (
          <p className="text-sm">Your account is managed by your institution. Ask your institution administrator.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                await api.del('/users/me', { body: { password, confirmation } })
                await logout().catch(() => undefined)
              })
            }}
          >
            <p className="text-sm text-slate-600">
              This permanently deletes your courses, notes, uploaded files, practice, mocks, plans and progress, and
              signs you out everywhere. It cannot be undone. Download your data first if you want a copy.
            </p>
            <label className="block text-sm">
              Password
              <input type="password" autoComplete="current-password" required className="input-base mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="block text-sm">
              Type <strong>DELETE MY ACCOUNT</strong> to confirm
              <input required className="input-base mt-1" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </label>
            <button className="btn-primary bg-red-600 hover:bg-red-700" disabled={busy || confirmation !== 'DELETE MY ACCOUNT'}>
              {busy ? 'Deleting…' : 'Delete my account permanently'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
