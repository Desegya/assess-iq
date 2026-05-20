import {
  UserRole,
  UserStatus,
  OrgType,
  SubscriptionPlan,
  QuestionType,
  QuestionDifficulty,
  QuestionStatus,
  BloomLevel,
  AssessmentStatus,
  AttemptStatus,
  DocumentStatus,
  DocumentType,
  IntegrityEventType,
  IntegritySeverity,
  AIAction,
  AIModel,
} from './enums'

// ─── Organization ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  type: OrgType
  plan: SubscriptionPlan
  trialEndDate: Date | null
  logoUrl: string | null
  website: string | null
  address: string | null
  country: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  organizationId: string | null
  name: string
  email: string
  role: UserRole
  status: UserStatus
  avatarUrl: string | null
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Never expose password in shared types
export type PublicUser = Omit<User, never>
export type AuthUser = { id: string; email: string; role: UserRole; organizationId: string | null }

// ─── Course ───────────────────────────────────────────────────────────────────

export interface Course {
  id: string
  organizationId: string
  teacherId: string
  title: string
  subject: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// ─── Topic ────────────────────────────────────────────────────────────────────

export interface Topic {
  id: string
  courseId: string
  name: string
  description: string | null
  parentTopicId: string | null
  order: number
  createdAt: Date
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface Document {
  id: string
  organizationId: string
  uploadedById: string
  courseId: string | null
  fileName: string
  fileType: DocumentType
  fileUrl: string
  fileSizeBytes: number
  status: DocumentStatus
  extractedText: string | null
  pageCount: number | null
  createdAt: Date
  updatedAt: Date
}

// ─── Question ─────────────────────────────────────────────────────────────────

export interface QuestionOption {
  key: string   // 'A' | 'B' | 'C' | 'D'
  text: string
}

export interface Question {
  id: string
  organizationId: string
  createdById: string
  topicId: string | null
  courseId: string | null
  sourceDocumentId: string | null
  questionText: string
  questionType: QuestionType
  options: QuestionOption[] | null  // MCQ only
  correctAnswer: string             // For MCQ: option key. For others: model answer
  explanation: string | null
  difficulty: QuestionDifficulty
  bloomLevel: BloomLevel | null
  status: QuestionStatus
  isAiGenerated: boolean
  aiGenerationId: string | null     // Links back to AIUsageLog
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export interface AssessmentSettings {
  randomizeQuestions: boolean
  randomizeOptions: boolean
  showResultsToStudent: boolean
  allowReview: boolean           // Student can review answers after submission
  maxAttempts: number            // 1 = single attempt only
  passMark: number | null        // Percentage e.g. 50
}

export interface Assessment {
  id: string
  organizationId: string
  courseId: string
  createdById: string
  title: string
  description: string | null
  instructions: string | null
  durationMinutes: number
  status: AssessmentStatus
  startTime: Date | null
  endTime: Date | null
  settings: AssessmentSettings
  totalQuestions: number
  totalMarks: number
  createdAt: Date
  updatedAt: Date
}

export interface AssessmentQuestion {
  id: string
  assessmentId: string
  questionId: string
  order: number
  scoreWeight: number   // Default 1, allows weighted questions
}

// ─── Attempt ──────────────────────────────────────────────────────────────────

export interface Attempt {
  id: string
  assessmentId: string
  studentId: string
  status: AttemptStatus
  startedAt: Date
  submittedAt: Date | null
  score: number | null          // Raw score
  percentageScore: number | null
  totalFlags: number            // Integrity flag count
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Answer ───────────────────────────────────────────────────────────────────

export interface Answer {
  id: string
  attemptId: string
  questionId: string
  selectedAnswer: string | null    // For MCQ: option key
  textAnswer: string | null        // For short answer / theory
  isCorrect: boolean | null        // null if not yet graded
  score: number | null
  timeTakenSeconds: number | null
  createdAt: Date
}

// ─── Integrity Event ──────────────────────────────────────────────────────────

export interface IntegrityEvent {
  id: string
  attemptId: string
  eventType: IntegrityEventType
  severity: IntegritySeverity
  metadata: Record<string, unknown>
  occurredAt: Date
}

// ─── AI Usage Log ─────────────────────────────────────────────────────────────

export interface AIUsageLog {
  id: string
  organizationId: string
  userId: string
  action: AIAction
  model: AIModel
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  success: boolean
  errorMessage: string | null
  relatedEntityId: string | null   // e.g. documentId, assessmentId
  createdAt: Date
}

// ─── Study Material (Study Companion outputs) ─────────────────────────────────

export interface Flashcard {
  id: string
  organizationId: string
  studentId: string
  documentId: string | null
  topicId: string | null
  front: string
  back: string
  createdAt: Date
}
