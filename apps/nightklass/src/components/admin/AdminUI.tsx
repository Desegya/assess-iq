'use client'
import { useRef, useState } from 'react'
import { StudyArtwork } from '@/components/product/StudyArtwork'
import { Icon } from '@/components/product/Icon'
import { adminRequest } from './admin-api'

export function DataState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  if (error) return <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{error}</p><button onClick={reload} className="btn-secondary mt-3 px-4">Try again</button></div>
  if (loading) return <div role="status" className="mt-8 space-y-4"><span className="sr-only">Loading administration data</span>{[0,1,2].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
  return null
}
export function AdminEmpty({ text = 'No records match your filters.' }: { text?: string }) {
  return <div className="flex flex-col items-center px-5 py-12 text-center"><StudyArtwork variant="search" className="mb-4 !w-36" /><p className="text-sm text-[#716778]">{text}</p></div>
}
export function Badge({ value }: { value: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${['ACTIVE','READY','APPROVED','COMPLETED','RESOLVED','OWNER'].includes(value) ? 'bg-[#f3edff] text-violet-800' : ['SUSPENDED','FAILED','REJECTED'].includes(value) ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-600'}`}>{value.toLowerCase().replaceAll('_', ' ')}</span>
}
export function Pagination({ page, total, limit = 20, onPage }: { page: number; total: number; limit?: number; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eae6ef] px-5 py-4 text-xs text-[#716778]"><p>{total ? `${(page-1)*limit+1}–${Math.min(page*limit,total)} of ${total}` : '0 records'}</p><div className="flex gap-2"><button className="btn-secondary px-4" disabled={page <= 1} onClick={() => onPage(page-1)}>Previous</button><button className="btn-secondary px-4" disabled={page*limit >= total} onClick={() => onPage(page+1)}>Next</button></div></div>
}
export function ActionDialog({ label, title, description, endpoint, payload, method = 'PATCH', onSuccess }: { label: string; title: string; description: string; endpoint: string; payload: Record<string, unknown>; method?: string; onSuccess: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  return <>
    <button type="button" className="btn-secondary inline-flex items-center gap-2 px-4 text-sm" onClick={() => { setReason(''); setError(''); dialog.current?.showModal() }}>{label}</button>
    <dialog ref={dialog} aria-labelledby={`dialog-${endpoint.replaceAll('/', '-')}`} className="nk-admin-dialog w-[calc(100%-32px)] max-w-lg rounded-2xl border border-[#eae6ef] bg-white p-6 text-[#241f2e]" onCancel={event => { if (saving) event.preventDefault() }}>
      <form onSubmit={async e => { e.preventDefault(); setSaving(true); setError(''); try { await adminRequest(endpoint, { method, body: JSON.stringify({ ...payload, reason }) }); dialog.current?.close(); onSuccess() } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save') } finally { setSaving(false) } }}>
        <h2 id={`dialog-${endpoint.replaceAll('/', '-')}`} className="text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-relaxed text-[#716778]">{description}</p>
        <label className="mt-5 block text-sm font-medium">Reason for this action<textarea className="input-base mt-2 w-full" required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} autoFocus /></label>
        {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" className="btn-secondary px-5" disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button><button className="btn-primary flex items-center gap-2 px-5" disabled={saving}><Icon name="check" />{saving ? 'Saving…' : 'Confirm action'}</button></div>
      </form>
    </dialog>
  </>
}
