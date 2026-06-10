-- Add unique join code to organizations for student self-registration
ALTER TABLE "organizations" ADD COLUMN "joinCode" TEXT NOT NULL DEFAULT '';

-- Backfill: generate a unique 8-char code for any existing orgs
UPDATE "organizations"
SET "joinCode" = upper(substring(md5(random()::text || id), 1, 4) || '-' || substring(md5(random()::text || id), 5, 4))
WHERE "joinCode" = '';

-- Now enforce uniqueness and remove the default
ALTER TABLE "organizations" ALTER COLUMN "joinCode" DROP DEFAULT;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_joinCode_key" UNIQUE ("joinCode");
