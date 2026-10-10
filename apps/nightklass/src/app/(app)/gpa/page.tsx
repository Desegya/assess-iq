'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { useApi } from '@/hooks/use-api'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { celebrate } from '@/lib/celebrate'

type Scale = 'FIVE' | 'FOUR'
type Semester = 'FIRST' | 'SECOND'

interface GpaEntry {
  id: string
  level: number
  semester: Semester
  courseTitle: string
  creditUnits: number
  grade: string
  scale: Scale
  gradePoint: number
}

const LEVELS = [100, 200, 300, 400, 500, 600]
const SEMESTER_LABEL: Record<Semester, string> = { FIRST: 'First Semester', SECOND: 'Second Semester' }

const GRADES: Record<Scale, string[]> = {
  FIVE: ['A', 'B', 'C', 'D', 'E', 'F'],
  FOUR: ['A', 'B', 'C', 'D', 'F'],
}

function classify(cgpa: number) {
  if (cgpa >= 4.5) return 'First Class'
  if (cgpa >= 3.5) return 'Second Class Upper'
  if (cgpa >= 2.4) return 'Second Class Lower'
  if (cgpa >= 1.5) return 'Third Class'
  return 'Pass'
}

export default function GpaPage() {
  const api = useApi()
  const [entries, setEntries] = useState<GpaEntry[] | null>(null)
  const [scale, setScale] = useState<Scale>('FIVE')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ level: '100', semester: 'FIRST' as Semester, courseTitle: '', creditUnits: '3', grade: 'A' })

  function load() {
    api
      .get<GpaEntry[]>('/gpa')
      .then(list => {
        setEntries(list)
        const last = list[list.length - 1]
        if (last) {
          setScale(last.scale)
          setForm(f => ({ ...f, level: String(last.level), semester: last.semester }))
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load your grades'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setForm(f => ({ ...f, grade: GRADES[scale][0]! }))
  }, [scale])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const entry = await api.post<GpaEntry>('/gpa', {
        level: Number(form.level),
        semester: form.semester,
        courseTitle: form.courseTitle,
        creditUnits: Number(form.creditUnits),
        grade: form.grade,
        scale,
      })
      setEntries(prev => [...(prev ?? []), entry])
      setForm(f => ({ ...f, courseTitle: '', creditUnits: '3' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    setEntries(prev => (prev ? prev.filter(e => e.id !== id) : prev))
    await api.del(`/gpa/${id}`).catch(() => load())
  }

  const visible = useMemo(() => (entries ?? []).filter(e => e.scale === scale), [entries, scale])
  const otherScaleCount = (entries ?? []).length - visible.length

  const bySemester = useMemo(() => {
    const map = new Map<string, GpaEntry[]>()
    for (const e of visible) {
      const label = `${e.level}L ${SEMESTER_LABEL[e.semester]}`
      map.set(label, [...(map.get(label) ?? []), e])
    }
    return map
  }, [visible])

  function gpaOf(list: GpaEntry[]) {
    const totalUnits = list.reduce((s, e) => s + e.creditUnits, 0)
    const totalPoints = list.reduce((s, e) => s + e.creditUnits * e.gradePoint, 0)
    return totalUnits > 0 ? totalPoints / totalUnits : 0
  }

  const cgpa = gpaOf(visible)
  const maxScale = scale === 'FIVE' ? 5 : 4

  useEffect(() => {
    if (visible.length > 0 && cgpa >= (scale === 'FIVE' ? 4.5 : 3.6)) celebrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(cgpa * 100)])

  return (
    <div className="space-y-6">
      <PageHeader title="Your progress, in perspective." description="Keep your grades together and see how each semester adds up." eyebrow="GPA & grades" icon="chart" action={
        <div className="inline-flex rounded-xl border border-[#eae6ef] bg-white p-1">
          {(['FIVE', 'FOUR'] as Scale[]).map(s => <button key={s} aria-pressed={scale === s} onClick={() => setScale(s)} className={`min-h-11 rounded-lg px-4 text-xs font-medium transition-colors ${scale === s ? 'bg-violet-50 text-violet-700' : 'text-slate-500'}`}>{s === 'FIVE' ? '5.0 scale' : '4.0 scale'}</button>)}
        </div>
      } />

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {entries === null && !error && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {entries && (
        <>
          {visible.length > 0 && (
            <div className="flex flex-wrap items-center gap-5 rounded-[20px] border border-[#e6d8fb] bg-[#f7f2ff] p-6">
              <ProgressRing
                percent={(cgpa / maxScale) * 100}
                size={80}
                strokeWidth={7}
                color="#7545cf"
                label={<span className="font-heading text-lg font-bold text-slate-900">{cgpa.toFixed(2)}</span>}
              />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cumulative GPA</p>
                <p className="font-heading text-xl font-bold text-slate-900 mt-0.5">
                  {cgpa.toFixed(2)} <span className="text-slate-400 text-sm font-normal">/ {maxScale.toFixed(1)}</span>
                </p>
                {scale === 'FIVE' && <p className="text-xs text-violet-600 font-semibold mt-1">{classify(cgpa)}</p>}
                {otherScaleCount > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    +{otherScaleCount} entr{otherScaleCount === 1 ? 'y' : 'ies'} on the {scale === 'FIVE' ? '4.0' : '5.0'} scale, not counted here
                  </p>
                )}
              </div>
            </div>
          )}

          {visible.length === 0 && (
            <EmptyState illustration="empty" title="No grades yet" subtitle="Add your first course below to start tracking your GPA." />
          )}

          <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
          <div className="space-y-4">
          {[...bySemester.entries()].map(([label, list]) => (
            <div key={label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-800">{label}</p>
                <p className="text-xs font-semibold text-violet-600">GPA: {gpaOf(list).toFixed(2)}</p>
              </div>
              <ul className="space-y-1.5">
                {list.map(e => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-y-2 border-b border-[#f3edf7] py-3 text-sm last:border-0">
                    <span className="text-slate-700 min-w-0 flex-1">{e.courseTitle}</span>
                    <span className="text-slate-400 text-xs mx-3">{e.creditUnits}cu</span>
                    <span className="w-6 text-center font-bold text-slate-800">{e.grade}</span>
                    <button onClick={() => handleRemove(e.id)} aria-label={`Remove grade for ${e.courseTitle}`} className="inline-flex min-h-11 items-center text-xs text-red-600 ml-3 flex-shrink-0">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          </div>

          <form onSubmit={handleAdd} className="card p-6 space-y-3">
            <p className="text-sm font-bold text-slate-800">Add a course</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={form.level}
                onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                className="input-base flex-1"
                aria-label="Level"
              >
                {LEVELS.map(l => (
                  <option key={l} value={l}>
                    {l} Level
                  </option>
                ))}
              </select>
              <select
                value={form.semester}
                onChange={e => setForm(f => ({ ...f, semester: e.target.value as Semester }))}
                className="input-base flex-1"
                aria-label="Semester"
              >
                {(Object.keys(SEMESTER_LABEL) as Semester[]).map(s => (
                  <option key={s} value={s}>
                    {SEMESTER_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                value={form.courseTitle}
                onChange={e => setForm(f => ({ ...f, courseTitle: e.target.value }))}
                placeholder="Course title"
                aria-label="Course title"
                className="input-base col-span-2"
              />
              <input
                required
                type="number"
                min={1}
                max={12}
                value={form.creditUnits}
                onChange={e => setForm(f => ({ ...f, creditUnits: e.target.value }))}
                aria-label="Credit units"
                className="input-base w-full"
              />
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} aria-label="Grade" className="input-base w-full">
                {GRADES[scale].map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              <Icon name="plus" />{saving ? 'Adding…' : 'Add course'}
            </button>
          </form>
          </div>
        </>
      )}
    </div>
  )
}
