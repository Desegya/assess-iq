import { UserRole, UserStatus, OrgType, SubscriptionPlan, QuestionType, QuestionDifficulty, QuestionStatus, BloomLevel, AssessmentStatus, AttemptStatus, DocumentStatus, DocumentType, IntegrityEventType, IntegritySeverity, AIAction, AIModel } from './enums';
export interface Organization {
    id: string;
    name: string;
    slug: string;
    type: OrgType;
    plan: SubscriptionPlan;
    trialEndDate: Date | null;
    logoUrl: string | null;
    website: string | null;
    address: string | null;
    country: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface User {
    id: string;
    organizationId: string | null;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    avatarUrl: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export type PublicUser = Omit<User, never>;
export type AuthUser = {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string | null;
};
export interface Course {
    id: string;
    organizationId: string;
    teacherId: string;
    title: string;
    subject: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Topic {
    id: string;
    courseId: string;
    name: string;
    description: string | null;
    parentTopicId: string | null;
    order: number;
    createdAt: Date;
}
export interface Document {
    id: string;
    organizationId: string;
    uploadedById: string;
    courseId: string | null;
    fileName: string;
    fileType: DocumentType;
    fileUrl: string;
    fileSizeBytes: number;
    status: DocumentStatus;
    extractedText: string | null;
    pageCount: number | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface QuestionOption {
    key: string;
    text: string;
}
export interface Question {
    id: string;
    organizationId: string;
    createdById: string;
    topicId: string | null;
    courseId: string | null;
    sourceDocumentId: string | null;
    questionText: string;
    questionType: QuestionType;
    options: QuestionOption[] | null;
    correctAnswer: string;
    explanation: string | null;
    difficulty: QuestionDifficulty;
    bloomLevel: BloomLevel | null;
    status: QuestionStatus;
    isAiGenerated: boolean;
    aiGenerationId: string | null;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface AssessmentSettings {
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
    showResultsToStudent: boolean;
    allowReview: boolean;
    maxAttempts: number;
    passMark: number | null;
}
export interface Assessment {
    id: string;
    organizationId: string;
    courseId: string;
    createdById: string;
    title: string;
    description: string | null;
    instructions: string | null;
    durationMinutes: number;
    status: AssessmentStatus;
    startTime: Date | null;
    endTime: Date | null;
    settings: AssessmentSettings;
    totalQuestions: number;
    totalMarks: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface AssessmentQuestion {
    id: string;
    assessmentId: string;
    questionId: string;
    order: number;
    scoreWeight: number;
}
export interface Attempt {
    id: string;
    assessmentId: string;
    studentId: string;
    status: AttemptStatus;
    startedAt: Date;
    submittedAt: Date | null;
    score: number | null;
    percentageScore: number | null;
    totalFlags: number;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface Answer {
    id: string;
    attemptId: string;
    questionId: string;
    selectedAnswer: string | null;
    textAnswer: string | null;
    isCorrect: boolean | null;
    score: number | null;
    timeTakenSeconds: number | null;
    createdAt: Date;
}
export interface IntegrityEvent {
    id: string;
    attemptId: string;
    eventType: IntegrityEventType;
    severity: IntegritySeverity;
    metadata: Record<string, unknown>;
    occurredAt: Date;
}
export interface AIUsageLog {
    id: string;
    organizationId: string;
    userId: string;
    action: AIAction;
    model: AIModel;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    durationMs: number;
    success: boolean;
    errorMessage: string | null;
    relatedEntityId: string | null;
    createdAt: Date;
}
export interface Flashcard {
    id: string;
    organizationId: string;
    studentId: string;
    documentId: string | null;
    topicId: string | null;
    front: string;
    back: string;
    createdAt: Date;
}
//# sourceMappingURL=entities.d.ts.map