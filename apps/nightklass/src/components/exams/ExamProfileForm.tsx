'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import type { AcademicProfile } from '@/lib/profile'

export function ExamProfileForm({ profile }: { profile: AcademicProfile | null }) {
  const api = useApi()
  const router = useRouter()
  const [stage, setStage] = useState(profile?.secondaryStage ?? 'SS3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.patch('/users/me/profile', {
        studyPathway: 'EXAM_PREPARATION', secondaryStage: stage,
        country: 'Nigeria', institutionType: 'SECONDARY_SCHOOL',
      })
      router.push('/exam-preparation')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile')
      setSaving(false)
    }
  }
  return <form onSubmit={save} className="card space-y-5 p-6 sm:p-8">
    <div><h2 className="text-xl font-semibold">Let’s prepare for your exams.</h2>
      <p className="mt-2 text-sm text-slate-500">Choose your stage, then set up WAEC, JAMB, or both. School leavers and repeat candidates are welcome.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <label className="block text-sm font-medium" htmlFor="secondary-stage">Your current stage</label>
    <select id="secondary-stage" className="input-base" value={stage} disabled={saving} onChange={e => setStage(e.target.value as typeof stage)}>
      <option value="SS1">SS1</option><option value="SS2">SS2</option><option value="SS3">SS3</option><option value="SCHOOL_LEAVER">Finished secondary school</option>
    </select>
    <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Choose my exams and subjects →'}</button>
  </form>
}
