export type TopicSource = 'OUTLINE' | 'MATERIAL' | 'AI_SUGGESTED' | 'AI_EXPANDED' | 'STUDENT'

export interface Topic {
  id: string
  name: string
  description: string | null
  estimatedMinutes: number | null
  order: number
  parentTopicId: string | null
  source: TopicSource
}

export interface TopicProposal {
  name: string
  description?: string
  subtopics?: string[]
}

// A batch of proposed topics waiting for the student's review
export interface ProposalSet {
  source: TopicSource
  proposals: TopicProposal[]
  // true when AI was unavailable and a basic text split was used instead
  fallback?: boolean
}

// Layer 1 = the student's/lecturer's own structure; layer 2 = Nightklass enrichment
export const SOURCE_BADGE: Record<TopicSource, { label: string; className: string }> = {
  OUTLINE: { label: 'Your outline', className: 'bg-emerald-50 text-emerald-700' },
  MATERIAL: { label: 'From your notes', className: 'bg-emerald-50 text-emerald-700' },
  STUDENT: { label: 'Added by you', className: 'bg-slate-100 text-slate-600' },
  AI_SUGGESTED: { label: 'AI suggested', className: 'bg-violet-50 text-violet-700' },
  AI_EXPANDED: { label: 'AI expansion', className: 'bg-violet-50 text-violet-700' },
}

export function isAiSource(source: TopicSource) {
  return source === 'AI_SUGGESTED' || source === 'AI_EXPANDED'
}
