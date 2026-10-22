-- CreateTable
CREATE TABLE "exam_materials" (
    "id" TEXT NOT NULL,
    "exam" "ExamFamily" NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_bank_questions" (
    "id" TEXT NOT NULL,
    "exam" "ExamFamily" NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "materialId" TEXT,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "fingerprint" TEXT NOT NULL,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_bank_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_materials_exam_subjectKey_status_idx" ON "exam_materials"("exam", "subjectKey", "status");

-- CreateIndex
CREATE INDEX "exam_bank_questions_exam_subjectKey_status_topic_idx" ON "exam_bank_questions"("exam", "subjectKey", "status", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "exam_bank_questions_exam_subjectKey_fingerprint_key" ON "exam_bank_questions"("exam", "subjectKey", "fingerprint");

-- AddForeignKey
ALTER TABLE "exam_bank_questions" ADD CONSTRAINT "exam_bank_questions_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "exam_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

