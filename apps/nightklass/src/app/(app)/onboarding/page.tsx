'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StudyArtwork } from '@/components/product/StudyArtwork'
import { useApi } from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'
import {
  INSTITUTION_TYPE_LABEL,
  LEVELS,
  SEMESTER_LABEL,
  type AcademicProfile,
  type InstitutionType,
  type Semester,
} from '@/lib/profile'

export default function OnboardingPage() {
  const api = useApi()
  const router = useRouter()
  const { user } = useAuth()

  const [form, setForm] = useState({
    country: 'Nigeria',
    institutionType: 'UNIVERSITY' as InstitutionType,
    programme: '',
    currentLevel: '',
    currentSemester: '' as Semester | '',
    institution: '',
    faculty: '',
    academicSession: '',
    graduationYear: '',
  })
  const [isEdit, setIsEdit] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Pre-fill when editing an existing profile
  useEffect(() => {
    api
      .get<AcademicProfile>('/users/me/profile')
      .then(p => {
        if (!p.profileCompletedAt) return
        setIsEdit(true)
        setForm({
          country: p.country ?? 'Nigeria',
          institutionType: p.institutionType ?? 'UNIVERSITY',
          programme: p.programme ?? '',
          currentLevel: p.currentLevel ? String(p.currentLevel) : '',
          currentSemester: p.currentSemester ?? '',
          institution: p.institution ?? '',
          faculty: p.faculty ?? '',
          academicSession: p.academicSession ?? '',
          graduationYear: p.graduationYear ? String(p.graduationYear) : '',
        })
        if (p.institution || p.faculty || p.academicSession || p.graduationYear) setShowMore(true)
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.patch('/users/me/profile', {
        country: form.country.trim(),
        institutionType: form.institutionType,
        programme: form.programme.trim(),
        currentLevel: Number(form.currentLevel),
        currentSemester: form.currentSemester,
        institution: form.institution.trim() || undefined,
        faculty: form.faculty.trim() || undefined,
        academicSession: form.academicSession.trim() || undefined,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
      })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your profile')
      setSaving(false)
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-heading text-2xl font-bold text-slate-900">
        {isEdit ? 'Your academic profile' : `Welcome, ${firstName}`}
      </h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">
        {isEdit
          ? 'Update this when you change level or semester.'
          : 'Tell us what you study so Nightklass can suggest your courses and set up your semester. Takes 30 seconds.'}
      </p>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-[#e9def8] bg-[#f7f2ff] px-5 py-4">
        <StudyArtwork className="hidden !w-28 shrink-0 sm:block" />
        <div><p className="text-sm font-semibold">A semester that fits you.</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Your programme and level help us suggest a starting point. You can always add and edit your own courses.</p></div>
      </div>
      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5">
        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div>
          <label htmlFor="programme" className="block text-sm font-medium text-slate-700 mb-1.5">
            Programme / department
          </label>
          <input
            id="programme"
            required
            minLength={2}
            value={form.programme}
            onChange={set('programme')}
            placeholder="Animal & Environmental Biology"
            disabled={saving}
            className="input-base"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="currentLevel" className="block text-sm font-medium text-slate-700 mb-1.5">Current level</label>
            <select id="currentLevel" required value={form.currentLevel} onChange={set('currentLevel')} disabled={saving} className="input-base">
              <option value="">Select</option>
              {LEVELS.map(l => (
                <option key={l} value={l}>
                  {l} Level
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="currentSemester" className="block text-sm font-medium text-slate-700 mb-1.5">Current semester</label>
            <select id="currentSemester" required value={form.currentSemester} onChange={set('currentSemester')} disabled={saving} className="input-base">
              <option value="">Select</option>
              {(Object.keys(SEMESTER_LABEL) as Semester[]).map(s => (
                <option key={s} value={s}>
                  {SEMESTER_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="institutionType" className="block text-sm font-medium text-slate-700 mb-1.5">Institution type</label>
            <select id="institutionType" required value={form.institutionType} onChange={set('institutionType')} disabled={saving} className="input-base">
              {(Object.keys(INSTITUTION_TYPE_LABEL) as InstitutionType[]).map(t => (
                <option key={t} value={t}>
                  {INSTITUTION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-1.5">Country</label>
            <input id="country" required minLength={2} value={form.country} onChange={set('country')} disabled={saving} className="input-base" />
          </div>
        </div>

        {!showMore ? (
          <button type="button" onClick={() => setShowMore(true)} className="text-sm text-violet-600 font-semibold">
            + Add your school and faculty (optional, for better suggestions)
          </button>
        ) : (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Optional</p>
            <div>
              <label htmlFor="institution" className="block text-sm font-medium text-slate-700 mb-1.5">Institution</label>
              <input id="institution" value={form.institution} onChange={set('institution')} placeholder="Edo State University" disabled={saving} className="input-base" />
            </div>
            <div>
              <label htmlFor="faculty" className="block text-sm font-medium text-slate-700 mb-1.5">Faculty</label>
              <input id="faculty" value={form.faculty} onChange={set('faculty')} placeholder="Faculty of Science" disabled={saving} className="input-base" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="academicSession" className="block text-sm font-medium text-slate-700 mb-1.5">Academic session</label>
                <input id="academicSession" value={form.academicSession} onChange={set('academicSession')} placeholder="2026/2027" disabled={saving} className="input-base" />
              </div>
              <div>
                <label htmlFor="graduationYear" className="block text-sm font-medium text-slate-700 mb-1.5">Graduation year</label>
                <input
                  id="graduationYear"
                  type="number"
                  min={2000}
                  max={2100}
                  value={form.graduationYear}
                  onChange={set('graduationYear')}
                  placeholder="2029"
                  disabled={saving}
                  className="input-base"
                />
              </div>
            </div>
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : isEdit ? 'Save profile' : 'Set up my semester →'}
        </button>
      </form>
    </div>
  )
}
