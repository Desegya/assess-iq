/*
  Warnings:

  - You are about to drop the column `courseOfStudy` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `programYears` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION', 'SECONDARY_SCHOOL', 'OTHER');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "isCarryover" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "courseOfStudy",
DROP COLUMN "programYears",
ADD COLUMN     "academicSession" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currentLevel" INTEGER,
ADD COLUMN     "currentSemester" "Semester",
ADD COLUMN     "faculty" TEXT,
ADD COLUMN     "graduationYear" INTEGER,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "institutionType" "InstitutionType",
ADD COLUMN     "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN     "programme" TEXT;
