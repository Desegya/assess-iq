-- CreateEnum
CREATE TYPE "ClassJoinPolicy" AS ENUM ('EMAIL_DOMAIN', 'EMAIL_LIST', 'APPROVAL', 'OPEN_LINK');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');

-- AlterEnum
ALTER TYPE "OrgType" ADD VALUE 'INDIVIDUAL';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "allowedEmailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allowedEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "joinCode" TEXT,
ADD COLUMN     "joinPolicy" "ClassJoinPolicy" NOT NULL DEFAULT 'EMAIL_DOMAIN',
ADD COLUMN     "joiningOpen" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_enrollments_studentId_status_idx" ON "course_enrollments"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_courseId_studentId_key" ON "course_enrollments"("courseId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "courses_joinCode_key" ON "courses"("joinCode");

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: existing institutional courses have no domain configured yet, so the
-- domain rule would lock everyone out. Start them on lecturer approval instead.
UPDATE "courses" SET "joinPolicy" = 'APPROVAL' WHERE "organizationId" IS NOT NULL;

-- Backfill: students who joined a school before classes existed keep access to
-- that school's courses (previously every student saw every published assessment).
INSERT INTO "course_enrollments" ("id", "courseId", "studentId", "status", "createdAt", "updatedAt")
SELECT 'ce_' || md5(c."id" || ':' || u."id"), c."id", u."id", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "courses" c
JOIN "users" u ON u."organizationId" = c."organizationId" AND u."role" = 'STUDENT'
WHERE c."organizationId" IS NOT NULL
ON CONFLICT ("courseId", "studentId") DO NOTHING;
