-- CreateEnum
CREATE TYPE "TopicSource" AS ENUM ('OUTLINE', 'MATERIAL', 'AI_SUGGESTED', 'AI_EXPANDED', 'STUDENT');

-- CreateEnum
CREATE TYPE "OutlineSource" AS ENUM ('UPLOAD', 'PASTE', 'PHOTO');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'PPTX';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "outlineSource" "OutlineSource",
ADD COLUMN     "outlineText" TEXT;

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "source" "TopicSource" NOT NULL DEFAULT 'STUDENT';

-- CreateTable
CREATE TABLE "outline_revisions" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outline_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outline_revisions_courseId_idx" ON "outline_revisions"("courseId");

-- AddForeignKey
ALTER TABLE "outline_revisions" ADD CONSTRAINT "outline_revisions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
