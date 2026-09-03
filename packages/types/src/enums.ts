// ─── User & Organization ──────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // Platform admin
  ORG_ADMIN = 'ORG_ADMIN',     // School/institution admin
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export enum OrgType {
  PRIMARY_SCHOOL = 'PRIMARY_SCHOOL',
  SECONDARY_SCHOOL = 'SECONDARY_SCHOOL',
  UNIVERSITY = 'UNIVERSITY',
  TUTORIAL_CENTER = 'TUTORIAL_CENTER',
  TRAINING_INSTITUTION = 'TRAINING_INSTITUTION',
  EXAM_BODY = 'EXAM_BODY',
  OTHER = 'OTHER',
}

export enum SubscriptionPlan {
  FREE_TRIAL = 'FREE_TRIAL',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

// ─── Questions & Assessments ──────────────────────────────────────────────────

export enum QuestionType {
  MCQ = 'MCQ',
  SHORT_ANSWER = 'SHORT_ANSWER',
  THEORY = 'THEORY',
  TRUE_FALSE = 'TRUE_FALSE',
}

export enum QuestionDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum QuestionStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum BloomLevel {
  REMEMBER = 'REMEMBER',
  UNDERSTAND = 'UNDERSTAND',
  APPLY = 'APPLY',
  ANALYZE = 'ANALYZE',
  EVALUATE = 'EVALUATE',
  CREATE = 'CREATE',
}

export enum AssessmentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ACTIVE = 'ACTIVE',     // Currently live / accepting submissions
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

// ─── Attempts ─────────────────────────────────────────────────────────────────

export enum AttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  AUTO_SUBMITTED = 'AUTO_SUBMITTED', // Timer expired
  GRADED = 'GRADED',
  ABANDONED = 'ABANDONED',
}

// ─── Documents ────────────────────────────────────────────────────────────────

export enum DocumentStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',   // Text extraction + chunking
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum DocumentType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  TXT = 'TXT',
}

// ─── Integrity ────────────────────────────────────────────────────────────────

export enum IntegrityEventType {
  TAB_SWITCH = 'TAB_SWITCH',
  WINDOW_BLUR = 'WINDOW_BLUR',
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  COPY_ATTEMPT = 'COPY_ATTEMPT',
  PASTE_ATTEMPT = 'PASTE_ATTEMPT',
  RIGHT_CLICK = 'RIGHT_CLICK',
  DEV_TOOLS_OPEN = 'DEV_TOOLS_OPEN',
  IDLE_WARNING = 'IDLE_WARNING',
}

export enum IntegritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export enum AIAction {
  GENERATE_QUESTIONS = 'GENERATE_QUESTIONS',
  GENERATE_SUMMARY = 'GENERATE_SUMMARY',
  GENERATE_FLASHCARDS = 'GENERATE_FLASHCARDS',
  EXTRACT_TOPICS = 'EXTRACT_TOPICS',
  REVIEW_QUALITY = 'REVIEW_QUALITY',
  WEAK_TOPIC_SUGGESTION = 'WEAK_TOPIC_SUGGESTION',
}

export enum AIModel {
  HAIKU = 'claude-haiku-4-5-20251001',     // Fast, cheap — tagging/classification
  SONNET = 'claude-sonnet-4-6',             // Default generation
  OPUS = 'claude-opus-4-7',                 // Premium review only
}

// ─── Study ────────────────────────────────────────────────────────────────────

export enum Semester {
  FIRST = 'FIRST',
  SECOND = 'SECOND',
}

export enum GpaScale {
  FIVE = 'FIVE',
  FOUR = 'FOUR',
}
