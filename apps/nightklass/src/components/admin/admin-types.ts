import type { LessonVisual } from '@assessiq/types'
import type { PageResult } from './admin-api'
export interface SummaryCourse {
  id: string
  title: string
  courseCode: string | null
  isActive: boolean
  owner: { id: string; name: string }
}
export interface AdminUser {
  id: string
  name: string
  email: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  programme: string | null
  institution: string | null
  currentLevel: number | null
  nightklassAdmin: { role: string } | null
  _count: { ownedCourses: number; studyPlans: number; studySessions: number; flashcards: number }
  courses: SummaryCourse[]
  sessions: { id: string; status: string; scheduledDate: string; course: { title: string } }[]
}
export interface AdminTopic {
  id: string
  name: string
  description: string | null
  order: number
  parentTopicId: string | null
  archivedAt: string | null
  source: string
  estimatedMinutes: number | null
  _count: { lessons: number; questions: number }
}
export interface AdminCourse extends SummaryCourse {
  subject: string
  description: string | null
  level: number | null
  semester: string | null
  creditUnits: number | null
  topics: PageResult<AdminTopic>
}
export interface AdminLesson {
  id: string
  version: number
  mode: string
  createdAt: string
  topic: { id: string; name: string; courseId: string }
  content: {
    introduction: string
    sections: { heading: string; body: string }[]
    summary: string[]
    objectives?: string[]
    visuals?: LessonVisual[]
  }
}
export interface AdminQuestion {
  id: string
  topicId: string
  courseId: string
  questionText: string
  questionType: string
  difficulty: string
  status: string
  correctAnswer: string
  explanation: string | null
  options: { key: string; text: string }[] | null
  marks: number | null
}
export interface AdminRecord {
  id: string
  name?: string
  email?: string
  title?: string
  courseCode?: string
  subject?: string
  status?: string
  createdAt?: string
  lastLoginAt?: string
  isActive?: boolean
  nightklassAdmin?: { role: string } | null
  owner?: { name: string }
  topic?: { name: string; course?: SummaryCourse }
  course?: SummaryCourse
  version?: number
  mode?: string
  questionText?: string
  questionType?: string
  difficulty?: string
  fileName?: string
  fileType?: string
  fileSizeBytes?: number
  chunkCount?: number
  uploadedBy?: { name: string }
  student?: { name: string }
  scheduledDate?: string
  actualMinutes?: number
  estimatedMinutes?: number
  reason?: string
  resolution?: string | null
  lesson?: { id: string; version: number; topic: { name: string } }
  actor?: { name: string }
  action?: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}
