'use client'

import { useState } from 'react'
import { adminRequest, useAdminData } from './admin-api'

type Material = { id: string; title: string; subject: string; topic: string; status: string; sourceNote: string }
type Question = { id: string; exam: string; subject: string; topic: string; status: string; revision: number; questionText: string; questionType: string; options?: { key: string; text: string }[]; correctAnswer: string; explanation: string; marks: number; difficulty: string; isAiGenerated: boolean }
export function AdminExamContent() {
  const [exam, setExam] = useState('JAMB')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [materialId, setMaterialId] = useState('')
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [questionType, setQuestionType] = useState('MCQ')
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Question | null>(null)
  const [editJson, setEditJson] = useState('')
  const [manual, setManual] = useState(false)
  const draft = editJson ? JSON.parse(editJson) : null
  function updateDraft(field: string, value: unknown) { setEditJson(JSON.stringify({ ...draft, [field]: value })) }
  const query = new URLSearchParams({ exam, ...(subject.trim() ? { subject: subject.trim() } : {}) })
  const materials = useAdminData<{ items: Material[]; total: number }>(`exam-content/materials?${query}`)
  const questions = useAdminData<{ items: Question[]; total: number }>(`exam-content/questions?${query}&page=${page}`)
  async function run(work: () => Promise<string>) {
    setBusy(true); setError(''); setMessage('')
    try { setMessage(await work()); materials.reload(); questions.reload() }
    catch (err) { setError(err instanceof Error ? err.message : 'Request failed') }
    finally { setBusy(false) }
  }
  function edit(q: Question) {
    setEditing(q); setManual(false)
    const { exam, subject, topic, questionText, questionType, options, correctAnswer, explanation, marks, difficulty } = q
    setEditJson(JSON.stringify({ exam, subject, topic, questionText, questionType, options, correctAnswer, explanation, marks, difficulty }, null, 2))
  }
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">WAEC / JAMB content</h1>
    <p className="text-sm text-slate-600">Upload teaching materials, generate and save original exam-style questions, then review before publishing to learners. Your account needs a Nightklass admin grant; an institutional teacher role alone does not grant access.</p>
    {(error || materials.error || questions.error) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error || materials.error || questions.error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{message}</p>}
    <fieldset disabled={busy} className="card grid gap-4 p-5 sm:grid-cols-3">
      <label className="text-sm">Exam<select className="input-base mt-2" value={exam} onChange={e => { setExam(e.target.value); setPage(1); setMaterialId(''); setQuestionType('MCQ') }}><option>JAMB</option><option>WAEC</option></select></label>
      <label className="text-sm">Subject<input className="input-base mt-2" maxLength={100} value={subject} onChange={e => { setSubject(e.target.value); setMaterialId(''); setPage(1) }} placeholder="Any science, arts or commercial subject" /></label>
      <label className="text-sm">Topic / learning objective<input className="input-base mt-2" maxLength={150} value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Separation of powers" /></label>
    </fieldset>
    <form className="card space-y-4 p-5" onSubmit={e => { e.preventDefault(); void run(async () => {
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Maximum upload size is 5 MB')
        const data = new FormData(); data.set('file', file); data.set('exam', exam); data.set('subject', subject); data.set('topic', topic); data.set('title', title); data.set('sourceNote', sourceNote)
        await adminRequest('exam-content/upload', { method: 'POST', body: data })
      } else await adminRequest('exam-content/materials', { method: 'POST', body: JSON.stringify({ exam, subject, topic, title, body, sourceNote }) })
      setBody(''); return 'Material saved as a draft. Publish when ready to share with learners.'
    }) }}>
      <h2 className="text-lg font-semibold">Add teacher material</h2>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">Title<input required minLength={2} maxLength={150} className="input-base mt-1" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="block text-sm">Source and permission to share<input required minLength={5} maxLength={1000} className="input-base mt-1" value={sourceNote} onChange={e => setSourceNote(e.target.value)} placeholder="e.g. My original teaching notes, approved for Nightklass students" /></label>
        <label className="block text-sm">Upload PDF, DOCX, PPTX or TXT (up to 5 MB)<input className="mt-2 block w-full" type="file" accept=".pdf,.docx,.pptx,.txt" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="block text-sm">Or paste notes<textarea className="input-base mt-1 min-h-36" required={!file} minLength={20} maxLength={50000} value={body} disabled={!!file} onChange={e => setBody(e.target.value)} /></label>
        <button className="btn-primary" disabled={subject.trim().length < 2 || topic.trim().length < 2}>Save material</button>
      </fieldset>
    </form>
    <section className="card space-y-3 p-5"><h2 className="text-lg font-semibold">Materials ({materials.data?.total ?? 0})</h2>
      {materials.loading && <p>Loading materials…</p>}
      {materials.data?.items.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">{m.title} · {m.status}</p><p className="text-sm text-slate-500">{m.subject} / {m.topic} · {m.sourceNote}</p></div><div className="flex gap-2"><button className="btn-secondary" disabled={busy} onClick={() => void run(async () => { setPreview(await adminRequest(`exam-content/materials/${m.id}`)); return 'Material preview loaded below.' })}>Preview</button><button className="btn-secondary" disabled={busy || m.status === 'ARCHIVED'} onClick={() => { setMaterialId(m.id); setTopic(m.topic); setMessage(`Selected ${m.title} for generation.`) }}>Use for generation</button><button className="btn-secondary" disabled={busy} onClick={() => void run(async () => { await adminRequest(`exam-content/materials/${m.id}`, { method: 'PATCH', body: JSON.stringify({ status: m.status === 'APPROVED' ? 'ARCHIVED' : 'APPROVED' }) }); return 'Material visibility updated.' })}>{m.status === 'APPROVED' ? 'Archive' : 'Publish'}</button></div></div>)}
    </section>
    {preview && <section className="card space-y-3 p-5"><h2 className="font-semibold">{preview.title}</h2><p className="max-h-96 overflow-auto whitespace-pre-wrap text-sm">{preview.body}</p><button className="btn-secondary" onClick={() => setPreview(null)}>Close preview</button></section>}
    <form className="card space-y-4 p-5" onSubmit={e => { e.preventDefault(); void run(async () => {
      const result = await adminRequest<{ saved: number; duplicates: number; rejected: number }>('exam-content/generate', { method: 'POST', body: JSON.stringify({ exam, subject, topic, count, difficulty, questionType, ...(materialId ? { materialId } : {}) }) })
      return `Saved ${result.saved} draft questions; ${result.duplicates} duplicates skipped; ${result.rejected} invalid items rejected. Review answers before publishing.`
    }) }}>
      <h2 className="text-lg font-semibold">Generate a saved question batch</h2>
      <p className="text-sm text-slate-600">{materialId ? 'Using selected teacher material as context.' : 'No material selected: generate from the subject and topic above.'} These are original AI-generated practice questions, not official past questions.</p>
      <fieldset disabled={busy} className="flex flex-wrap gap-4">
        <label className="text-sm">Count<input type="number" className="input-base mt-1" min={1} max={10} value={count} onChange={e => setCount(Number(e.target.value))} /></label>
        <label className="text-sm">Difficulty<select className="input-base mt-1" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></label>
        <label className="text-sm">Question type<select className="input-base mt-1" value={questionType} onChange={e => setQuestionType(e.target.value)}>{(exam === 'JAMB' ? ['MCQ'] : ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'THEORY']).map(t => <option key={t}>{t}</option>)}</select></label>
        <button type="button" className="btn-secondary" onClick={() => setMaterialId('')}>Use topic only</button>
        <button className="btn-primary" disabled={subject.trim().length < 2 || topic.trim().length < 2}>{busy ? 'Working…' : 'Generate and save drafts'}</button>
      </fieldset>
    </form>
    <section className="space-y-4"><div className="flex justify-between"><h2 className="text-lg font-semibold">Question bank ({questions.data?.total ?? 0})</h2><button className="btn-secondary" disabled={busy} onClick={() => { setEditing(null); setManual(true); setEditJson(JSON.stringify({ exam, subject, topic, questionText: '', questionType: 'MCQ', options: ['A','B','C','D'].map(key => ({ key, text: '' })), correctAnswer: 'A', explanation: '', marks: 1, difficulty: 'MEDIUM' }, null, 2)) }}>Author a question</button></div>
      {questions.loading && <p>Loading questions…</p>}
      {questions.data?.items.map(q => <article key={q.id} className="card space-y-3 p-5">
        <p className="text-xs text-slate-500">{q.subject} / {q.topic} · {q.status} · revision {q.revision} · {q.isAiGenerated ? 'AI-assisted' : 'Teacher-authored'}</p>
        <p className="whitespace-pre-wrap font-medium">{q.questionText}</p>
        {q.options?.map(o => <p key={o.key}>{o.key}. {o.text}</p>)}
        <p className="text-sm"><strong>Answer:</strong> {q.correctAnswer}</p><p className="whitespace-pre-wrap text-sm text-slate-600">{q.explanation}</p>
        <div className="flex gap-2">{q.status === 'DRAFT' && <><button className="btn-secondary" disabled={busy} onClick={() => edit(q)}>Edit draft</button><button className="btn-primary" disabled={busy} onClick={() => void run(async () => { await adminRequest(`exam-content/questions/${q.id}/state`, { method: 'POST', body: JSON.stringify({ status: 'APPROVED', expectedRevision: q.revision }) }); return 'Reviewed question published.' })}>Approve & publish</button></>}{q.status !== 'ARCHIVED' && <button className="btn-secondary" disabled={busy} onClick={() => void run(async () => { await adminRequest(`exam-content/questions/${q.id}/state`, { method: 'POST', body: JSON.stringify({ status: 'ARCHIVED', expectedRevision: q.revision }) }); return 'Question archived; existing practice history is preserved.' })}>Archive</button>}</div>
      </article>)}
      <div className="flex items-center gap-3"><button className="btn-secondary" disabled={page === 1 || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button className="btn-secondary" disabled={busy || page * 20 >= (questions.data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </section>
    {(editing || manual) && <form className="card space-y-4 p-5" onSubmit={e => { e.preventDefault(); void run(async () => { const payload = JSON.parse(editJson); await adminRequest(editing ? `exam-content/questions/${editing.id}` : 'exam-content/questions', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...payload, ...(editing ? { expectedRevision: editing.revision } : {}) }) }); setEditing(null); setManual(false); return 'Draft saved.' }) }}><h2 className="font-semibold">{editing ? 'Edit question draft' : 'Author a question'}</h2>{draft && <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm">Question<textarea required className="input-base mt-1 min-h-28" minLength={5} maxLength={10000} value={draft.questionText} onChange={e => updateDraft('questionText', e.target.value)} /></label>
      <label className="block text-sm">Question type<select className="input-base mt-1" value={draft.questionType} onChange={e => updateDraft('questionType', e.target.value)}>{(draft.exam === 'JAMB' ? ['MCQ'] : ['MCQ','TRUE_FALSE','SHORT_ANSWER','THEORY']).map(t => <option key={t}>{t}</option>)}</select></label>
      {draft.questionType === 'MCQ' && ['A','B','C','D'].map(key => <label key={key} className="block text-sm">Option {key}<input required className="input-base mt-1" maxLength={2000} value={(draft.options ?? []).find((o: { key: string }) => o.key === key)?.text ?? ''} onChange={e => updateDraft('options', ['A','B','C','D'].map(k => ({ key: k, text: k === key ? e.target.value : (draft.options ?? []).find((o: { key: string }) => o.key === k)?.text ?? '' })))} /></label>)}
      <label className="block text-sm">{draft.questionType === 'MCQ' ? 'Correct option key (A–D)' : 'Model answer'}<textarea required className="input-base mt-1" maxLength={10000} value={draft.correctAnswer} onChange={e => updateDraft('correctAnswer', e.target.value)} /></label>
      <label className="block text-sm">Explanation / marking points<textarea required minLength={5} maxLength={10000} className="input-base mt-1 min-h-28" value={draft.explanation} onChange={e => updateDraft('explanation', e.target.value)} /></label>
      <label className="block text-sm">Marks<input type="number" min={1} max={100} className="input-base mt-1" value={draft.marks} onChange={e => updateDraft('marks', Number(e.target.value))} /></label>
    </fieldset>}<button className="btn-primary" disabled={busy}>Save draft</button><button type="button" className="btn-secondary ml-3" onClick={() => { setEditing(null); setManual(false) }}>Cancel</button></form>}
  </div>
}
