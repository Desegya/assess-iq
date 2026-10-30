/** Stored with a lesson version; URLs are added only after authorizing a read. */
export interface LessonVisual {
  kind: 'process' | 'illustration'
  sectionIndex: number
  title: string
  caption: string
  alt: string
  steps: { label: string; detail: string }[]
  storageKey?: string
  url?: string
}

/** Model output. Storage keys and download URLs are never supplied by the model. */
export interface LessonVisualPlan {
  kind: 'process' | 'illustration'
  sectionIndex: number
  title: string
  caption: string
  alt: string
  steps: { label: string; detail: string }[]
  imagePrompt: string
}
