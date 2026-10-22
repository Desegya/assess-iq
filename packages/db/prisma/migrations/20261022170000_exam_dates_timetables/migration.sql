-- AlterTable
ALTER TABLE "exam_goals" ADD COLUMN     "series" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "exam_calendars" (
    "id" TEXT NOT NULL,
    "exam" "ExamFamily" NOT NULL,
    "year" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "sourceNote" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "entries" JSONB NOT NULL,
    "fileKey" TEXT,
    "fileName" TEXT,
    "extractedText" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_calendars_exam_year_series_status_idx" ON "exam_calendars"("exam", "year", "series", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_calendars_exam_year_series_version_key" ON "exam_calendars"("exam", "year", "series", "version");


-- Existing WAEC goals target school-candidate papers unless subsequently changed.
UPDATE "exam_goals" SET "series" = 'SCHOOL' WHERE "exam" = 'WAEC';
ALTER TABLE "exam_goals" ADD CONSTRAINT "exam_goal_series" CHECK (("exam" = 'JAMB' AND "series" = 'GENERAL') OR ("exam" = 'WAEC' AND "series" IN ('SCHOOL','PRIVATE_FIRST','PRIVATE_SECOND')));
ALTER TABLE "exam_calendars" ADD CONSTRAINT "exam_calendar_series" CHECK (("exam" = 'JAMB' AND "series" = 'GENERAL') OR ("exam" = 'WAEC' AND "series" IN ('SCHOOL','PRIVATE_FIRST','PRIVATE_SECOND')));
