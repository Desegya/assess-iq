// Pure study-plan scheduler (docs/nightklass/01-product-vision.md §7-8). No database access, so the same logic
// builds a fresh plan and re-plans the remainder of an existing one.

export interface PlanTopic {
  id: string
  name: string
  estimatedMinutes: number | null
  subtopicCount: number
  // 0-100 from quizzes, null when never assessed
  mastery: number | null
  // Average 1-5 self-rating from completed sessions, null when none
  confidence: number | null
  // Learning minutes already completed for this topic in earlier sessions
  completedMinutes: number
}

export interface PlanSlot {
  date: Date
  startTime: string
  endTime: string
  capacityMinutes: number
}

export interface PlannedSession {
  scheduledDate: Date
  startTime: string
  endTime: string
  estimatedMinutes: number
  topicId: string | null
  kind: 'LEARN' | 'REVIEW' | 'REVISION'
  weekNumber: number
  note?: string
}

export const DEFAULT_TOPIC_MINUTES = 45
const MIN_LEARN_MINUTES = 20
const REVIEW_MINUTES = 20
const REVIEW_GAP_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

// Weak topics get more time, strong ones less; low self-confidence counts like a weak quiz score
export function topicWeight(t: Pick<PlanTopic, 'mastery' | 'confidence'>): number {
  if (t.mastery !== null) {
    if (t.mastery < 50) return 1.3
    if (t.mastery >= 80) return 0.6
    return 1
  }
  if (t.confidence !== null && t.confidence <= 2) return 1.2
  return 1
}

function baseMinutes(t: PlanTopic): number {
  return t.estimatedMinutes ?? Math.min(120, DEFAULT_TOPIC_MINUTES + 10 * t.subtopicCount)
}

export function learningNeed(t: PlanTopic): number {
  return Math.max(0, Math.round(baseMinutes(t) * topicWeight(t)) - t.completedMinutes)
}

export function buildPlan(
  topics: PlanTopic[],
  slots: PlanSlot[],
  options: { planStart: Date; examDate: Date },
): { sessions: PlannedSession[]; scaledDown: boolean; unscheduledTopics: string[] } {
  const weekOf = (d: Date) => Math.floor((d.getTime() - options.planStart.getTime()) / (7 * DAY_MS)) + 1
  if (slots.length === 0) return { sessions: [], scaledDown: false, unscheduledTopics: topics.map(t => t.name) }

  // 1. Final revision block — bigger when the exam is close
  const daysToExam = (options.examDate.getTime() - slots[0]!.date.getTime()) / DAY_MS
  const revisionShare = daysToExam <= 14 ? 0.25 : 0.15
  const revisionCount = slots.length >= 4 ? Math.max(1, Math.round(slots.length * revisionShare)) : slots.length > 1 ? 1 : 0
  const learnSlots = slots.slice(0, slots.length - revisionCount)
  const revisionSlots = slots.slice(slots.length - revisionCount)

  // 2. How much learning each topic still needs; scale down to fit, keeping room for spaced reviews
  const needs = topics.map(t => ({ topic: t, minutes: learningNeed(t) })).filter(n => n.minutes > 0)
  const capacity = learnSlots.reduce((sum, s) => sum + s.capacityMinutes, 0)
  const totalNeed = needs.reduce((sum, n) => sum + n.minutes, 0)
  const learnBudget = Math.floor(capacity * 0.85)
  let scaledDown = false
  if (totalNeed > learnBudget && totalNeed > 0) {
    scaledDown = true
    const factor = learnBudget / totalNeed
    for (const n of needs) n.minutes = Math.max(MIN_LEARN_MINUTES, Math.round(n.minutes * factor))
  }

  // 3. Fill slots in outline order; queue a spaced review a week after each topic finishes
  const sessions: PlannedSession[] = []
  const reviews: { topic: PlanTopic; due: Date }[] = []
  let needIndex = 0
  const unscheduled = new Set(needs.map(n => n.topic.name))

  for (const slot of learnSlots) {
    let remaining = slot.capacityMinutes
    const push = (s: Omit<PlannedSession, 'scheduledDate' | 'startTime' | 'endTime' | 'weekNumber'>) =>
      sessions.push({ ...s, scheduledDate: slot.date, startTime: slot.startTime, endTime: slot.endTime, weekNumber: weekOf(slot.date) })

    // Due reviews first, weakest topics first, but never more than half the slot
    reviews.sort((a, b) => (a.topic.mastery ?? 50) - (b.topic.mastery ?? 50))
    for (let i = 0; i < reviews.length && remaining >= REVIEW_MINUTES; ) {
      const r = reviews[i]!
      if (r.due <= slot.date && remaining > slot.capacityMinutes / 2) {
        push({ topicId: r.topic.id, kind: 'REVIEW', estimatedMinutes: REVIEW_MINUTES, note: 'Spaced review' })
        remaining -= REVIEW_MINUTES
        reviews.splice(i, 1)
      } else i++
    }

    while (remaining > 0 && needIndex < needs.length) {
      const need = needs[needIndex]!
      const chunk = Math.min(need.minutes, remaining)
      // Avoid tiny leftover fragments: a sliver under 15 minutes waits for the next slot
      if (chunk < 15 && need.minutes > chunk) break
      // Time owed to a topic the student already studied fully is extra revision, not first-time learning
      const alreadyLearned = need.topic.completedMinutes >= baseMinutes(need.topic)
      push({
        topicId: need.topic.id,
        kind: alreadyLearned ? 'REVIEW' : 'LEARN',
        estimatedMinutes: chunk,
        ...(alreadyLearned &&
          need.topic.mastery !== null &&
          need.topic.mastery < 50 && { note: `Extra revision: quiz average ${Math.round(need.topic.mastery)}%` }),
      })
      unscheduled.delete(need.topic.name)
      need.minutes -= chunk
      remaining -= chunk
      if (need.minutes <= 0) {
        reviews.push({ topic: need.topic, due: new Date(slot.date.getTime() + REVIEW_GAP_DAYS * DAY_MS) })
        needIndex++
      }
    }
  }

  // 4. Revision: weakest (or never-assessed) topics first, rotating through all of them
  const byWeakness = [...topics].sort((a, b) => (a.mastery ?? 40) - (b.mastery ?? 40))
  revisionSlots.forEach((slot, i) => {
    const topic = byWeakness.length ? byWeakness[i % byWeakness.length]! : null
    sessions.push({
      scheduledDate: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      estimatedMinutes: slot.capacityMinutes,
      topicId: topic?.id ?? null,
      kind: 'REVISION',
      weekNumber: weekOf(slot.date),
      note: topic ? 'Final revision, weakest topics first' : 'Final revision',
    })
  })

  return { sessions, scaledDown, unscheduledTopics: [...unscheduled] }
}

// ─── Sharing study time between courses ─────────────────────────────────────

export interface PlanWindow {
  id: string
  // Exclusive: the plan uses slots strictly before this date
  end: Date
  // Relative share of a slot on a given date (e.g. credit units, boosted near the exam)
  weight: (date: Date) => number
}

const MIN_SPLIT_MINUTES = 25

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h! * 60 + m! + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Divides the student's study slots between their active course plans so sessions never overlap.
// A slot is split into consecutive time windows by weight; when a split would leave a course under
// MIN_SPLIT_MINUTES, the whole slot goes to whichever course is most owed time so far (fair rotation).
export function allocateSlots(windows: PlanWindow[], slots: PlanSlot[]): Map<string, PlanSlot[]> {
  const result = new Map<string, PlanSlot[]>(windows.map(w => [w.id, []]))
  const owed = new Map<string, number>(windows.map(w => [w.id, 0]))

  for (const slot of slots) {
    const active = windows.filter(w => slot.date < w.end)
    if (active.length === 0) continue
    const weights = active.map(w => Math.max(0.01, w.weight(slot.date)))
    const total = weights.reduce((a, b) => a + b, 0)
    const shares = weights.map(w => (slot.capacityMinutes * w) / total)

    if (active.length === 1 || Math.min(...shares) >= MIN_SPLIT_MINUTES) {
      let offset = 0
      active.forEach((w, i) => {
        // Last course takes the remainder so rounding never loses minutes
        const minutes = i === active.length - 1 ? slot.capacityMinutes - offset : Math.floor(shares[i]!)
        const startTime = addMinutes(slot.startTime, offset)
        result.get(w.id)!.push({ date: slot.date, startTime, endTime: addMinutes(startTime, minutes), capacityMinutes: minutes })
        offset += minutes
      })
    } else {
      active.forEach((w, i) => owed.set(w.id, owed.get(w.id)! + shares[i]!))
      const pick = active.reduce((best, w) => (owed.get(w.id)! > owed.get(best.id)! ? w : best))
      owed.set(pick.id, owed.get(pick.id)! - slot.capacityMinutes)
      result.get(pick.id)!.push(slot)
    }
  }
  return result
}
