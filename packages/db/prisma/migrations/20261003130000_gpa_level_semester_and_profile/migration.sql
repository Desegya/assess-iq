-- Brings the database in line with schema changes made in 364b898, which shipped without a migration.
-- Written defensively (IF EXISTS / IF NOT EXISTS) because some dev databases were synced with `prisma db push`.

-- AlterTable: academic profile fields on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "courseOfStudy" TEXT,
ADD COLUMN IF NOT EXISTS "programYears" INTEGER;

-- AlterTable: gpa_entries.semesterLabel (free text, e.g. "200L First Semester") -> level + semester
ALTER TABLE "gpa_entries" ADD COLUMN IF NOT EXISTS "level" INTEGER,
ADD COLUMN IF NOT EXISTS "semester" "Semester";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpa_entries' AND column_name = 'semesterLabel'
  ) THEN
    -- Best-effort backfill: first 3-digit number is the level; "second"/"2nd" means SECOND, anything else FIRST
    UPDATE "gpa_entries" SET
      "level" = COALESCE("level", NULLIF(substring("semesterLabel" from '([1-7]00)'), '')::INTEGER, 100),
      "semester" = COALESCE(
        "semester",
        CASE WHEN "semesterLabel" ~* '(second|2nd)' THEN 'SECOND'::"Semester" ELSE 'FIRST'::"Semester" END
      );
    ALTER TABLE "gpa_entries" DROP COLUMN "semesterLabel";
  END IF;
END $$;

ALTER TABLE "gpa_entries" ALTER COLUMN "level" SET NOT NULL,
ALTER COLUMN "semester" SET NOT NULL;
