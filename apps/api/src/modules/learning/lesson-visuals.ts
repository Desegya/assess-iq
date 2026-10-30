import type { LessonVisualPlan } from '@assessiq/types'

/** Bound untrusted model output before rendering it or sending it to the image API. */
export function sanitizeVisualPlans(
  value: unknown,
  sectionCount: number,
  clean: (v: unknown) => string,
): LessonVisualPlan[] {
  if (!Array.isArray(value)) return []
  const plans: LessonVisualPlan[] = []
  let illustration = false
  for (const item of value) {
    if (!item || typeof item !== 'object' || plans.length >= 2) continue
    const p = item as Record<string, unknown>
    if (
      !Number.isInteger(p.sectionIndex) ||
      Number(p.sectionIndex) < 0 ||
      Number(p.sectionIndex) >= sectionCount
    )
      continue
    if (p.kind !== 'process' && p.kind !== 'illustration') continue
    const title = clean(p.title).slice(0, 160)
    const caption = clean(p.caption).slice(0, 1200)
    const alt = clean(p.alt).slice(0, 1200)
    if (!title || !caption || !alt) continue
    const steps = Array.isArray(p.steps)
      ? p.steps.slice(0, 6).flatMap((s) => {
          if (!s || typeof s !== 'object') return []
          const label = clean(s.label).slice(0, 160)
          const detail = clean(s.detail).slice(0, 600)
          return label && detail ? [{ label, detail }] : []
        })
      : []
    const imagePrompt = clean(p.imagePrompt).slice(0, 3000)
    if (p.kind === 'process' && steps.length < 2) continue
    if (p.kind === 'illustration' && (illustration || !imagePrompt)) continue
    plans.push({
      kind: p.kind,
      sectionIndex: Number(p.sectionIndex),
      title,
      caption,
      alt,
      steps: p.kind === 'process' ? steps : [],
      imagePrompt: p.kind === 'illustration' ? imagePrompt : '',
    })
    if (p.kind === 'illustration') illustration = true
  }
  return plans
}

/** Explicit release gate until billing supplies per-user premium entitlements. */
export function canGenerateLessonVisuals(
  access: string,
  userId: string,
  allowedUsers: string,
): boolean {
  if (access === 'all') return true
  return (
    access === 'allowlist' &&
    allowedUsers
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .includes(userId)
  )
}
