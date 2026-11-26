'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useApi } from '@/hooks/use-api'
import { ApiError, publicApi } from '@/lib/api/client'
import { forgetJoinCode, rememberJoinCode } from '@/lib/pending-join'
import { Notice } from '@/components/auth/FormParts'

interface ClassPreview {
  title: string
  courseCode: string | null
  lecturer: string | null
  joinPolicy: 'EMAIL_DOMAIN' | 'EMAIL_LIST' | 'APPROVAL' | 'OPEN_LINK'
  allowedEmailDomains: string[]
  joiningOpen: boolean
}
type Outcome =
  | { kind: 'joined' | 'pending'; message: string }
  | { kind: 'refused'; code?: string; message: string }

export function ruleSentence(p: Pick<ClassPreview, 'joinPolicy' | 'allowedEmailDomains'>) {
  switch (p.joinPolicy) {
    case 'EMAIL_DOMAIN':
      return `Join with your school email (${p.allowedEmailDomains.map(d => `@${d}`).join(' or ')}).`
    case 'EMAIL_LIST':
      return 'Your lecturer has a list of student emails. Join with the email they have for you.'
    case 'APPROVAL':
      return 'Ask to join, and your lecturer will let you in.'
    default:
      return 'Anyone with this link can join.'
  }
}

export function JoinClass({ code }: { code: string }) {
  const router = useRouter()
  const api = useApi()
  const { user, isLoading, logout, refreshAccessToken } = useAuth()
  const [preview, setPreview] = useState<ClassPreview | null>(null)
  const [invalid, setInvalid] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState<string | null>(null)

  useEffect(() => {
    rememberJoinCode(code)
    publicApi<ClassPreview>(`/classes/join/${encodeURIComponent(code)}`)
      .then(setPreview)
      .catch((err: unknown) => setInvalid(err instanceof Error ? err.message : 'This class link is not valid.'))
  }, [code])

  async function join() {
    setBusy(true)
    setOutcome(null)
    try {
      const res = await api.post<{ status: 'ACTIVE' | 'PENDING'; message: string }>(`/classes/join/${encodeURIComponent(code)}`, {})
      forgetJoinCode()
      setOutcome({ kind: res.status === 'ACTIVE' ? 'joined' : 'pending', message: res.message })
    } catch (err) {
      setOutcome({
        kind: 'refused',
        code: err instanceof ApiError ? err.code : undefined,
        message: err instanceof Error ? err.message : 'Could not join this class.',
      })
    } finally {
      setBusy(false)
    }
  }

  const refusal = outcome?.kind === 'refused' ? outcome.code : undefined
  const domain = preview?.joinPolicy === 'EMAIL_DOMAIN' ? preview.allowedEmailDomains[0] : undefined
  const back = `/join/${encodeURIComponent(code)}`
  const signupHref = `/signup?redirect=${encodeURIComponent(back)}${domain ? `&domain=${encodeURIComponent(domain)}` : ''}`
  const loginHref = `/login?redirect=${encodeURIComponent(back)}`

  if (invalid) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Class link not found</h1>
        <div className="mt-6">
          <Notice kind="error">{invalid}</Notice>
        </div>
        <Link href="/join" className="btn-secondary mt-6 w-full">
          Enter a class code instead
        </Link>
      </div>
    )
  }
  if (!preview || isLoading) return <p role="status" className="text-sm text-slate-500">Loading class…</p>

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-[.12em] text-violet-700">You are invited to join</p>
      <h1 className="font-heading text-2xl font-bold text-slate-900">{preview.title}</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        {[preview.courseCode, preview.lecturer].filter(Boolean).join(' · ')}
      </p>

      <div className="card mt-6 p-5">
        <p className="text-sm font-medium text-slate-900">How to get in</p>
        <p className="mt-1 text-sm text-slate-600">{ruleSentence(preview)}</p>
        {!preview.joiningOpen && (
          <p className="mt-3 text-sm font-medium text-red-700">This class is not accepting new students right now.</p>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {outcome?.kind === 'joined' && (
          <>
            <Notice kind="ok">{outcome.message}</Notice>
            <button className="btn-primary w-full" onClick={() => router.push('/student/assessments')}>
              See your tests
            </button>
          </>
        )}
        {outcome?.kind === 'pending' && (
          <>
            <Notice kind="info">{outcome.message}</Notice>
            <Link href="/student/classes" className="btn-secondary w-full">
              Go to my classes
            </Link>
          </>
        )}
        {outcome?.kind === 'refused' && <Notice kind="error">{outcome.message}</Notice>}

        {!user && (
          <>
            <Link href={signupHref} className="btn-primary w-full">
              Create a student account
            </Link>
            <Link href={loginHref} className="btn-secondary w-full">
              I already have an account
            </Link>
          </>
        )}

        {user && user.role !== 'STUDENT' && (
          <Notice kind="info">
            You are signed in as a lecturer ({user.email}). Students join with their own student account.
          </Notice>
        )}

        {user?.role === 'STUDENT' && outcome?.kind !== 'joined' && outcome?.kind !== 'pending' && (
          <>
            {refusal === 'EMAIL_NOT_VERIFIED' ? (
              <>
                {resent && <Notice kind="info">{resent}</Notice>}
                <button
                  className="btn-primary w-full"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    await refreshAccessToken()
                    await join()
                  }}
                >
                  I&rsquo;ve confirmed my email, join now
                </button>
                <button
                  className="btn-secondary w-full"
                  disabled={busy}
                  onClick={async () => {
                    const r = await api.post<{ message: string }>('/auth/verify-email/resend', { app: 'kwikeval' }).catch(() => null)
                    setResent(r?.message ?? 'Could not send right now. Try again in a minute.')
                  }}
                >
                  Send the confirmation email again
                </button>
              </>
            ) : refusal === 'DOMAIN_MISMATCH' || refusal === 'NOT_ON_LIST' ? (
              <>
                <p className="text-sm text-slate-600">
                  You are signed in as <span className="font-medium">{user.email}</span>.
                </p>
                <button
                  className="btn-primary w-full"
                  onClick={async () => {
                    await logout()
                    router.push(signupHref)
                  }}
                >
                  Sign out and use my school email
                </button>
              </>
            ) : (
              refusal !== 'REMOVED' &&
              refusal !== 'CLOSED' && (
                <>
                  <p className="text-sm text-slate-600">
                    Signed in as <span className="font-medium">{user.email}</span>
                  </p>
                  <button className="btn-primary w-full" disabled={busy || !preview.joiningOpen} onClick={() => void join()}>
                    {busy ? 'Joining…' : preview.joinPolicy === 'APPROVAL' ? 'Ask to join' : 'Join class'}
                  </button>
                </>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
