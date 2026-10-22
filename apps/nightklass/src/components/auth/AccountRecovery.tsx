'use client'

import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  const message = Array.isArray(data.message) ? data.message.join('. ') : data.message
  if (!res.ok) throw new Error(message ?? 'Something went wrong. Please try again.')
  return message ?? ''
}

// Until React hydrates, a submit would fall back to a native form post; keep the
// buttons disabled so a fast tap on a slow phone never loses or exposes input.
function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}

// Links carry the token in the URL fragment, which browsers never send to servers.
function tokenFromFragment() {
  const match = /token=([^&]+)/.exec(window.location.hash)
  return match ? decodeURIComponent(match[1]!) : ''
}

function Shell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{intro}</p>
      </div>
      {children}
      <p className="mt-6 text-center text-sm text-slate-500">
        <a href="/login" className="font-semibold text-violet-600 hover:text-violet-700">
          Back to sign in
        </a>
      </p>
    </div>
  )
}

function Notice({ kind, text }: { kind: 'error' | 'ok'; text: string }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
    >
      {text}
    </div>
  )
}

export function ForgotPasswordForm() {
  const hydrated = useHydrated()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  return (
    <Shell title="Reset your password" intro="Enter the email you signed up with. We will send a link that works once and expires in 30 minutes.">
      <form
        method="post"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setLoading(true)
          setState(null)
          try {
            setState({ kind: 'ok', text: await post('/auth/forgot-password', { email }) })
          } catch (err) {
            setState({ kind: 'error', text: (err as Error).message })
          } finally {
            setLoading(false)
          }
        }}
      >
        {state && <Notice {...state} />}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="input-base" />
        </div>
        <button type="submit" disabled={loading || !hydrated} className="btn-primary mt-2 w-full">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </Shell>
  )
}

export function ResetPasswordForm() {
  const hydrated = useHydrated()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setToken(tokenFromFragment())
    // Remove the token from the address bar and history once read.
    history.replaceState(null, '', window.location.pathname)
  }, [])
  const done = state?.kind === 'ok'
  return (
    <Shell title="Choose a new password" intro="Resetting signs you out on every device.">
      {!token && !done ? (
        <Notice kind="error" text="This reset link is incomplete. Open the link from your email again, or request a new one." />
      ) : (
        <form
          method="post"
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (password !== confirm) return setState({ kind: 'error', text: 'The passwords do not match.' })
            setLoading(true)
            setState(null)
            try {
              setState({ kind: 'ok', text: await post('/auth/reset-password', { token, password }) })
            } catch (err) {
              setState({ kind: 'error', text: (err as Error).message })
            } finally {
              setLoading(false)
            }
          }}
        >
          {state && <Notice {...state} />}
          {!done && (
            <>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  New password
                </label>
                <input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} className="input-base" />
              </div>
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm new password
                </label>
                <input id="confirm" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} className="input-base" />
              </div>
              <button type="submit" disabled={loading || !hydrated} className="btn-primary mt-2 w-full">
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </>
          )}
        </form>
      )}
    </Shell>
  )
}

export function VerifyEmail() {
  const [state, setState] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  useEffect(() => {
    const token = tokenFromFragment()
    history.replaceState(null, '', window.location.pathname)
    if (!token) return setState({ kind: 'error', text: 'This verification link is incomplete. Open it from your email again.' })
    post('/auth/verify-email', { token })
      .then((text) => setState({ kind: 'ok', text: text || 'Email verified.' }))
      .catch((err: Error) => setState({ kind: 'error', text: err.message }))
  }, [])
  return (
    <Shell title="Confirm your email" intro="A confirmed email lets you recover your account if you forget your password.">
      {state ? <Notice {...state} /> : <p role="status">Confirming…</p>}
    </Shell>
  )
}
