'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brand } from '@/components/product/Brand'
import { StudyArtwork } from '@/components/product/StudyArtwork'
import { Icon } from '@/components/product/Icon'
import { adminRequest } from '@/components/admin/admin-api'
export default function AdminLogin() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  return <main className="grid min-h-dvh lg:grid-cols-2">
    <aside className="hidden flex-col justify-between bg-[#f3edff] p-16 lg:flex"><Brand /><div><StudyArtwork className="mb-8 !w-64" /><h1 className="product-display">A thoughtful product.<br />A well-run platform.</h1><p className="mt-6 max-w-md text-sm leading-relaxed text-[#716778]">Support learners, improve content, and keep Nightklass running with clarity.</p></div><p className="text-xs text-violet-800">Nightklass administration</p></aside>
    <div className="flex flex-col px-6 py-8 sm:px-12"><Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-[#716778]"><Icon name="back" />Back to Nightklass</Link><div className="mx-auto my-auto w-full max-w-sm py-12"><p className="text-xs font-medium uppercase tracking-widest text-violet-700">Administration</p><h1 className="mt-4">Welcome back.</h1><p className="mt-4 text-sm text-[#716778]">Sign in with your authorized Nightklass account.</p>
      <form className="mt-8 space-y-5" onSubmit={async e => { e.preventDefault(); setSaving(true); setError(''); const form = new FormData(e.currentTarget); try { await adminRequest('auth', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) }); router.replace('/admin'); router.refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in') } finally { setSaving(false) } }}>
        <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="username" required className="input-base mt-2 w-full" /></label>
        <label className="block text-sm font-medium">Password<div className="relative mt-2"><input name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required className="input-base w-full !pr-12" /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-1 top-0 flex h-full w-11 items-center justify-center"><Icon name={visible ? 'eyeOff' : 'eye'} /></button></div></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">{saving ? 'Signing in…' : 'Sign in to administration'}<Icon name="arrow" /></button>
      </form><p className="mt-6 text-xs leading-relaxed text-[#716778]">Access is granted by a platform owner. Contact your owner if you need an administrative account.</p>
    </div></div>
  </main>
}
