-- CreateEnum
CREATE TYPE "GpaScale" AS ENUM ('FIVE', 'FOUR');

-- CreateTable
CREATE TABLE "gpa_entries" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semesterLabel" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "creditUnits" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "scale" "GpaScale" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpa_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gpa_entries_studentId_idx" ON "gpa_entries"("studentId");

-- AddForeignKey
ALTER TABLE "gpa_entries" ADD CONSTRAINT "gpa_entries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
