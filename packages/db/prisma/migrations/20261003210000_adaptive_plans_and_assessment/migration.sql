-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('EXAM_DATE', 'DURATION');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('LEARN', 'REVIEW', 'REVISION');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "marks" INTEGER;

-- AlterTable
ALTER TABLE "study_plans" ADD COLUMN     "changeLog" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "planType" "PlanType" NOT NULL DEFAULT 'EXAM_DATE',
ADD COLUMN     "weeks" INTEGER;

-- AlterTable
ALTER TABLE "study_sessions" ADD COLUMN     "kind" "SessionKind" NOT NULL DEFAULT 'LEARN',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "weekNumber" INTEGER;

-- CreateTable
CREATE TABLE "self_quiz_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "self_quiz_attempts_studentId_topicId_idx" ON "self_quiz_attempts"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "self_quiz_attempts_courseId_idx" ON "self_quiz_attempts"("courseId");

