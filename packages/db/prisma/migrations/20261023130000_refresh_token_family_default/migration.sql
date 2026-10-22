-- Lets the previous API version (which does not set familyId) keep issuing refresh
-- tokens during a rolling deploy; each such token becomes its own family.
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" SET DEFAULT (gen_random_uuid())::text;
