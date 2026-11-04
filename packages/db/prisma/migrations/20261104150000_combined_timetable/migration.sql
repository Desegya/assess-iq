ALTER TABLE "study_plans" ADD COLUMN "timetableId" TEXT;
CREATE INDEX "study_plans_studentId_timetableId_idx" ON "study_plans"("studentId", "timetableId");
