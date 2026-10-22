CREATE TYPE "StudyPathway" AS ENUM ('TERTIARY', 'EXAM_PREPARATION');
CREATE TYPE "SecondaryStage" AS ENUM ('SS1', 'SS2', 'SS3', 'SCHOOL_LEAVER');
CREATE TYPE "ExamFamily" AS ENUM ('JAMB', 'WAEC');
ALTER TABLE "users" ADD COLUMN "studyPathway" "StudyPathway" NOT NULL DEFAULT 'TERTIARY', ADD COLUMN "secondaryStage" "SecondaryStage";
ALTER TABLE "courses" ADD COLUMN "examSubjectKey" TEXT;
CREATE UNIQUE INDEX "courses_ownerId_examSubjectKey_key" ON "courses"("ownerId", "examSubjectKey");
CREATE TABLE "exam_goals" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "exam" "ExamFamily" NOT NULL,
  "year" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exam_goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_goals_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "exam_goals_studentId_exam_year_key" ON "exam_goals"("studentId", "exam", "year");
CREATE TABLE "exam_goal_subjects" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "exam_goal_subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_goal_subjects_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "exam_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_goal_subjects_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "exam_goal_subjects_goalId_subjectKey_key" ON "exam_goal_subjects"("goalId", "subjectKey");
CREATE INDEX "exam_goal_subjects_courseId_idx" ON "exam_goal_subjects"("courseId");
