-- CreateEnum
CREATE TYPE "LessonMode" AS ENUM ('MATERIAL', 'AI', 'COMBINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AIAction" ADD VALUE 'EMBED_CONTENT';
ALTER TYPE "AIAction" ADD VALUE 'RECOMMEND_RESOURCES';

-- AlterTable
ALTER TABLE "topics" DROP COLUMN "notes",
DROP COLUMN "notesGeneratedAt",
ADD COLUMN     "resources" JSONB,
ADD COLUMN     "resourcesFetchedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "topicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_lessons" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mode" "LessonMode" NOT NULL,
    "content" JSONB NOT NULL,
    "sourceChunkIds" TEXT[],
    "sourceDocumentIds" TEXT[],
    "model" TEXT,
    "feedback" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_chunks_courseId_idx" ON "document_chunks"("courseId");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "topic_lessons_topicId_version_key" ON "topic_lessons"("topicId", "version");

-- CreateIndex
CREATE INDEX "content_reports_lessonId_idx" ON "content_reports"("lessonId");

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_lessons" ADD CONSTRAINT "topic_lessons_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "topic_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

