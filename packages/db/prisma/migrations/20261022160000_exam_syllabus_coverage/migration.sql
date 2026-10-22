-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "sourceExamBankQuestionId" TEXT;

-- AlterTable
ALTER TABLE "exam_bank_questions" ADD COLUMN     "generationJobId" TEXT,
ADD COLUMN     "supersedesId" TEXT;

-- CreateTable
CREATE TABLE "exam_syllabuses" (
    "id" TEXT NOT NULL,
    "exam" "ExamFamily" NOT NULL,
    "year" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceNote" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_syllabuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_syllabus_objectives" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "exam_syllabus_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_question_objectives" (
    "questionId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,

    CONSTRAINT "exam_question_objectives_pkey" PRIMARY KEY ("questionId","objectiveId")
);

-- CreateTable
CREATE TABLE "exam_objective_study_links" (
    "studentId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "exam_objective_study_links_pkey" PRIMARY KEY ("studentId","objectiveId")
);

-- CreateTable
CREATE TABLE "exam_generation_jobs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_syllabuses_exam_year_subjectKey_status_idx" ON "exam_syllabuses"("exam", "year", "subjectKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_syllabuses_exam_year_subjectKey_version_key" ON "exam_syllabuses"("exam", "year", "subjectKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "exam_syllabus_objectives_syllabusId_code_key" ON "exam_syllabus_objectives"("syllabusId", "code");

-- CreateIndex
CREATE INDEX "exam_question_objectives_objectiveId_idx" ON "exam_question_objectives"("objectiveId");

-- CreateIndex
CREATE INDEX "exam_objective_study_links_topicId_idx" ON "exam_objective_study_links"("topicId");

-- CreateIndex
CREATE INDEX "exam_generation_jobs_status_nextAt_idx" ON "exam_generation_jobs"("status", "nextAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_generation_jobs_actorId_requestKey_key" ON "exam_generation_jobs"("actorId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "exam_bank_questions_supersedesId_key" ON "exam_bank_questions"("supersedesId");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_sourceExamBankQuestionId_fkey" FOREIGN KEY ("sourceExamBankQuestionId") REFERENCES "exam_bank_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_bank_questions" ADD CONSTRAINT "exam_bank_questions_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "exam_generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_bank_questions" ADD CONSTRAINT "exam_bank_questions_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "exam_bank_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_syllabus_objectives" ADD CONSTRAINT "exam_syllabus_objectives_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "exam_syllabuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_objectives" ADD CONSTRAINT "exam_question_objectives_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "exam_bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_objectives" ADD CONSTRAINT "exam_question_objectives_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "exam_syllabus_objectives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_objective_study_links" ADD CONSTRAINT "exam_objective_study_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_objective_study_links" ADD CONSTRAINT "exam_objective_study_links_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "exam_syllabus_objectives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_objective_study_links" ADD CONSTRAINT "exam_objective_study_links_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve reviewed-practice source identity for historical evidence.
UPDATE "questions" AS q SET "sourceExamBankQuestionId" = b."id"
FROM "exam_bank_questions" AS b WHERE q."tags"[1] = 'exam-bank' AND q."tags"[2] = b."id";
ALTER TABLE "exam_generation_jobs" ADD CONSTRAINT "exam_generation_job_status" CHECK ("status" IN ('QUEUED','RUNNING','SUCCEEDED','FAILED'));
