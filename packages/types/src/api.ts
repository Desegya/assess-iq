// ─── Generic API response shapes ─────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface ApiError {
  success: false
  message: string
  errors?: Record<string, string[]>
  statusCode: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginDto {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface RegisterOrgDto {
  orgName: string
  orgType: string
  adminName: string
  adminEmail: string
  password: string
  country?: string
}

// ─── AI Generation ────────────────────────────────────────────────────────────

export interface GenerateQuestionsDto {
  documentId?: string
  topicId?: string
  courseId: string
  manualText?: string       // Teacher can paste text directly
  questionCount: number
  questionTypes: string[]
  difficulty: string
  bloomLevel?: string
}

export interface GeneratedQuestionDraft {
  questionText: string
  questionType: string
  options: Array<{ key: string; text: string }> | null
  correctAnswer: string
  explanation: string | null
  difficulty: string
  bloomLevel: string | null
  suggestedTopicName: string | null
  tags: string[]
}

export interface GenerateQuestionsResult {
  questions: GeneratedQuestionDraft[]
  aiUsageLogId: string
  model: string
  totalTokens: number
}
