-- Launch-readiness security, AI-quota and exam-integrity foundations.
-- Additive except for hashing refresh tokens in place (see below).

-- CreateEnum
CREATE TYPE "EmailTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AIAction" ADD VALUE 'EXTRACT_TIMETABLE';
ALTER TYPE "AIAction" ADD VALUE 'CHAT';
ALTER TYPE "AIAction" ADD VALUE 'GENERATE_LESSON';
ALTER TYPE "AIAction" ADD VALUE 'GRADE_ANSWERS';

-- DropIndex
DROP INDEX "ai_usage_logs_userId_idx";

-- DropIndex
DROP INDEX "refresh_tokens_token_idx";

-- AlterTable
ALTER TABLE "ai_usage_logs" ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "exam_bank_questions" ADD COLUMN     "fingerprintVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "generatorModel" TEXT,
ADD COLUMN     "generatorPromptVersion" TEXT;

-- AlterTable
-- Existing sessions keep working: each legacy token becomes its own family and
-- the stored raw value is replaced by its SHA-256 digest (the API now looks
-- tokens up by digest). Raw refresh tokens are 3-segment JWTs, never 64-hex
-- digests, so the WHERE clause makes this step safe to re-run.
ALTER TABLE "refresh_tokens" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "rotatedAt" TIMESTAMP(3);
UPDATE "refresh_tokens" SET "familyId" = "id" WHERE "familyId" IS NULL;
UPDATE "refresh_tokens" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
  WHERE "token" !~ '^[0-9a-f]{64}$';
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "email_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "EmailTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runtime_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "exam_cohort_members" (
    "userId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_cohort_members_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "exam_question_exposures" (
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_question_exposures_pkey" PRIMARY KEY ("studentId","questionId")
);

-- CreateTable
CREATE TABLE "exam_question_reports" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "attemptId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_tokens_tokenHash_key" ON "email_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "email_tokens_userId_purpose_createdAt_idx" ON "email_tokens"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "exam_question_exposures_questionId_idx" ON "exam_question_exposures"("questionId");

-- CreateIndex
CREATE INDEX "exam_question_reports_status_createdAt_idx" ON "exam_question_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_question_reports_reporterId_questionId_key" ON "exam_question_reports"("reporterId", "questionId");

-- CreateIndex
CREATE INDEX "ai_usage_logs_userId_createdAt_idx" ON "ai_usage_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- AddForeignKey
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_cohort_members" ADD CONSTRAINT "exam_cohort_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_exposures" ADD CONSTRAINT "exam_question_exposures_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_exposures" ADD CONSTRAINT "exam_question_exposures_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "exam_bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_reports" ADD CONSTRAINT "exam_question_reports_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "exam_bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_reports" ADD CONSTRAINT "exam_question_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

