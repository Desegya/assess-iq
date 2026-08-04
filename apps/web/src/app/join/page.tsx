'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/ui/Logo'
import { UserRole } from '@assessiq/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

interface OrgInfo {
  id: string
  name: string
  type: string
}

type Step = 'code' | 'register' | 'done'

const inputClass =
  'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ' +
  'focus:border-violet-500 transition-all duration-150'

function JoinPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { login }    = useAuth()

  const [step,      setStep]      = useState<Step>('code')
  const [org,       setOrg]       = useState<OrgInfo | null>(null)
  const [code,      setCode]      = useState(searchParams.get('code') ?? '')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [checking,  setChecking]  = useState(false)

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [showPass, setShowPass] = useState(false)
  const codeInputRef = useRef<HTMLInputElement>(null)

  // Auto-check if code is in the URL query param
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) void checkCode(urlCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Format code input as XXXX-XXXX
  function handleCodeInput(raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const formatted = clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}` : clean
    setCode(formatted)
    setCodeError(null)
  }

  async function checkCode(rawCode?: string) {
    const target = (rawCode ?? code).replace('-', '').trim()
    if (target.length < 4) { setCodeError('Enter a valid join code'); return }
    setChecking(true); setCodeError(null)
    try {
      const res = await fetch(`${API_URL}/auth/org/${encodeURIComponent(rawCode ?? code)}`)
      if (!res.ok) throw new Error('Invalid or expired join code')
      const data = await res.json() as OrgInfo
      setOrg(data)
      setStep('register')
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setChecking(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setSubmitError('Passwords do not match'); return
    }
    setSubmitting(true); setSubmitError(null)

    try {
      const res = await fetch(`${API_URL}/auth/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, joinCode: code }),
      })
      if (!res.ok) {
        const err = await res.json() as { message?: string }
        throw new Error(Array.isArray(err.message) ? err.message[0] : (err.message ?? 'Registration failed'))
      }
      const data = await res.json() as {
        user: { id: string; name: string; email: string; role: UserRole; organizationId: string }
        accessToken: string
        refreshToken: string
        expiresIn: number
      }
      login(data.user, data.accessToken, data.refreshToken, data.expiresIn)
      setStep('done')
      setTimeout(() => router.push('/student/dashboard'), 1500)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="md" theme="dark" />
        </div>

        {/* ── Step 1: Enter join code ── */}
        {step === 'code' && (
          <div className="bg-white rounded-3xl shadow-card border border-slate-200 p-8 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h1 className="font-heading text-xl font-bold text-slate-900">Join your school</h1>
              <p className="text-slate-500 text-sm mt-1">
                Enter the join code your teacher shared with you
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  ref={codeInputRef}
                  type="text"
                  value={code}
                  onChange={e => handleCodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void checkCode()}
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  className={`${inputClass} text-center text-xl font-heading font-bold tracking-widest uppercase
                               ${codeError ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20' : ''}`}
                />
                {codeError && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {codeError}
                  </p>
                )}
              </div>

              <button
                onClick={() => void checkCode()}
                disabled={checking || code.replace('-', '').length < 4}
                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98]
                           disabled:opacity-50 text-white font-semibold py-3 rounded-xl
                           text-sm transition-all duration-150 flex items-center justify-center gap-2"
              >
                {checking ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Checking…
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-sm text-slate-400 mt-6">
              Already have an account?{' '}
              <a href="/login" className="text-violet-600 font-semibold hover:text-violet-700 transition-colors">
                Log in
              </a>
            </p>
          </div>
        )}

        {/* ── Step 2: Registration form ── */}
        {step === 'register' && org && (
          <div className="bg-white rounded-3xl shadow-card border border-slate-200 p-8 animate-scale-in">
            {/* Org confirmation banner */}
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100
                            rounded-2xl px-4 py-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-white w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-violet-600 font-semibold">Joining as a student</p>
                <p className="text-sm font-bold text-violet-900">{org.name}</p>
              </div>
              <button
                onClick={() => { setStep('code'); setOrg(null) }}
                className="ml-auto text-xs text-violet-500 hover:text-violet-700 transition-colors"
              >
                Change
              </button>
            </div>

            <h1 className="font-heading text-xl font-bold text-slate-900 mb-1">Create your account</h1>
            <p className="text-slate-500 text-sm mb-6">Fill in your details to get started</p>

            <form onSubmit={e => void handleRegister(e)} className="space-y-4">
              {submitError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm
                                rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Amaka Obi"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="amaka@example.com"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                    required minLength={8}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                               hover:text-slate-600 transition-colors"
                  >
                    {showPass ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Re-enter password"
                  required
                  className={`${inputClass} ${form.confirm && form.confirm !== form.password ? 'border-red-300 focus:border-red-400' : ''}`}
                />
                {form.confirm && form.confirm !== form.password && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || (!!form.confirm && form.confirm !== form.password)}
                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98]
                           disabled:opacity-60 text-white font-semibold py-3 rounded-xl
                           text-sm transition-all duration-150 mt-2 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Creating account…
                  </>
                ) : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-5">
              Already have an account?{' '}
              <a href="/login" className="text-violet-600 font-semibold hover:text-violet-700 transition-colors">
                Log in
              </a>
            </p>
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 'done' && (
          <div className="bg-white rounded-3xl shadow-card border border-slate-200 p-10
                          text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center
                            justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-bold text-slate-900">You&apos;re in!</h2>
            <p className="text-slate-500 text-sm mt-2">Taking you to your dashboard…</p>
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {[0, 150, 300].map(d => (
                <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                     style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinPageContent />
    </Suspense>
  )
}
