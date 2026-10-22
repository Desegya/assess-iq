-- CreateTable
CREATE TABLE "exam_mock_templates" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "englishCount" INTEGER NOT NULL,
    "otherCount" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_mock_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_mock_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "activeKey" TEXT,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "version" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submissionReason" TEXT,
    "specification" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "flags" TEXT[],
    "result" JSONB,

    CONSTRAINT "exam_mock_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_mock_templates_year_key" ON "exam_mock_templates"("year");

-- CreateIndex
CREATE UNIQUE INDEX "exam_mock_attempts_activeKey_key" ON "exam_mock_attempts"("activeKey");

-- CreateIndex
CREATE INDEX "exam_mock_attempts_status_expiresAt_idx" ON "exam_mock_attempts"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "exam_mock_attempts_studentId_startedAt_idx" ON "exam_mock_attempts"("studentId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_mock_attempts_studentId_requestKey_key" ON "exam_mock_attempts"("studentId", "requestKey");

-- AddForeignKey
ALTER TABLE "exam_mock_attempts" ADD CONSTRAINT "exam_mock_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mock_attempts" ADD CONSTRAINT "exam_mock_attempts_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "exam_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mock_attempts" ADD CONSTRAINT "exam_mock_attempts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "exam_mock_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

