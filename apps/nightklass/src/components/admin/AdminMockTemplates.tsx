'use client'
import { useState } from 'react'
import { adminRequest, useAdminData } from './admin-api'
interface Template { id: string; year: number; title: string; durationMinutes: number; englishCount: number; otherCount: number; instructions: string; sourceNote: string; status: string; revision: number }
export function AdminMockTemplates() {
  const templates = useAdminData<Template[]>('exam-content/mock-templates')
  const [form, setForm] = useState({ year: new Date().getFullYear() + 1, title: 'JAMB-style full practice mock', durationMinutes: 120, englishCount: 60, otherCount: 40, instructions: 'Answer all questions across English and your three selected subjects. One overall timer applies. This is a Nightklass practice mock.', sourceNote: '', status: 'DRAFT', expectedRevision: 0 })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  return <section className="card space-y-4 p-5"><h2 className="text-lg font-semibold">JAMB mock specifications</h2>
    <p className="text-sm text-slate-600">Verify the applicable examination-year rules before publishing. Defaults follow the published JAMB baseline of 60 English questions plus 40 each for three subjects in 120 minutes. Publication enables complete mocks only when enough reviewed questions exist.</p>
    {templates.error && <p role="alert">{templates.error}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="flex flex-wrap gap-2">{templates.data?.map(t => <button key={t.id} disabled={busy} className="btn-secondary" onClick={() => { setForm({ year: t.year, title: t.title, durationMinutes: t.durationMinutes, englishCount: t.englishCount, otherCount: t.otherCount, instructions: t.instructions, sourceNote: t.sourceNote, status: t.status, expectedRevision: t.revision }); setMessage(`Editing ${t.year} revision ${t.revision}`) }}>{t.year} · {t.status} · edit</button>)}</div>
    <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const saved = await adminRequest<Template>('exam-content/mock-templates', { method: 'POST', body: JSON.stringify(form) }); setForm(f => ({ ...f, expectedRevision: saved.revision })); setMessage('Mock specification saved. Existing attempts retain their original rules.'); templates.reload() } catch (err) { setError(err instanceof Error ? err.message : 'Could not save') } finally { setBusy(false) } }}>
      <fieldset disabled={busy} className="space-y-3"><div className="grid gap-3 sm:grid-cols-4">{(['year','durationMinutes','englishCount','otherCount'] as const).map(field => <label className="text-sm" key={field}>{{ year: 'Year', durationMinutes: 'Minutes', englishCount: 'English questions', otherCount: 'Questions per other subject' }[field]}<input className="input-base mt-1" required type="number" min={field === 'year' ? 2026 : 1} max={field === 'year' ? 2100 : field === 'durationMinutes' ? 240 : 100} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: Number(e.target.value), ...(field === 'year' ? { expectedRevision: 0 } : {}) }))} /></label>)}</div>
      <label className="block text-sm">Title<input className="input-base mt-1" required minLength={5} maxLength={150} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></label>
      <label className="block text-sm">Instructions<textarea className="input-base mt-1" required minLength={20} maxLength={10000} value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} /></label>
      <label className="block text-sm">Rule source and verification note (optional)<input className="input-base mt-1" maxLength={1000} value={form.sourceNote} onChange={e => setForm(f => ({ ...f, sourceNote: e.target.value }))} placeholder="Source document/link, applicable year, reviewer and verification date" /></label>
      <label className="block text-sm">Visibility<select className="input-base mt-1" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option value="DRAFT">Draft</option><option value="APPROVED">Reviewed and published</option><option value="ARCHIVED">Archived</option></select></label>
      <button className="btn-primary">Save mock specification</button></fieldset>
    </form>
  </section>
}
