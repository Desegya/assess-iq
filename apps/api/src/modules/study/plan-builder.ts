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

export function learningNeed(t: PlanTopic): number {
  const base = t.estimatedMinutes ?? Math.min(120, DEFAULT_TOPIC_MINUTES + 10 * t.subtopicCount)
  return Math.max(0, Math.round(base * topicWeight(t)) - t.completedMinutes)
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
      push({ topicId: need.topic.id, kind: 'LEARN', estimatedMinutes: chunk })
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
