-- AlterTable
ALTER TABLE "exam_mock_attempts" ADD COLUMN     "gradingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gradingLeaseUntil" TIMESTAMP(3),
ADD COLUMN     "gradingNextAt" TIMESTAMP(3),
ADD COLUMN     "selectedQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "waecPaperId" TEXT,
ALTER COLUMN "templateId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "waec_paper_templates" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "paperCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waec_paper_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waec_paper_templates_year_series_subjectKey_paperCode_key" ON "waec_paper_templates"("year", "series", "subjectKey", "paperCode");

-- AddForeignKey
ALTER TABLE "exam_mock_attempts" ADD CONSTRAINT "exam_mock_attempts_waecPaperId_fkey" FOREIGN KEY ("waecPaperId") REFERENCES "waec_paper_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "exam_mock_attempts" ADD CONSTRAINT "exam_mock_attempts_one_template" CHECK (("templateId" IS NOT NULL)::int + ("waecPaperId" IS NOT NULL)::int = 1);
