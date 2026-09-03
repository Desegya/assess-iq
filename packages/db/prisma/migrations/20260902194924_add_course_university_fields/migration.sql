-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('FIRST', 'SECOND');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "courseCode" TEXT,
ADD COLUMN     "level" INTEGER,
ADD COLUMN     "semester" "Semester";
