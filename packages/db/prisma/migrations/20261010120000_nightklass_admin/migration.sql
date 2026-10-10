CREATE TYPE "NightklassAdminRole" AS ENUM ('ADMIN', 'OWNER');
CREATE TABLE "nightklass_admins" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "role" "NightklassAdminRole" NOT NULL DEFAULT 'ADMIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nightklass_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "nightklass_admin_audits" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nightklass_admin_audits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "nightklass_admin_audits_createdAt_idx" ON "nightklass_admin_audits"("createdAt");
CREATE INDEX "nightklass_admin_audits_resourceType_resourceId_idx" ON "nightklass_admin_audits"("resourceType", "resourceId");
CREATE INDEX "nightklass_admin_audits_actorId_idx" ON "nightklass_admin_audits"("actorId");
ALTER TABLE "content_reports" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN', ADD COLUMN "resolution" TEXT, ADD COLUMN "resolvedAt" TIMESTAMP(3), ADD COLUMN "resolvedById" TEXT;
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED', 'DISMISSED'));
CREATE INDEX "content_reports_status_createdAt_idx" ON "content_reports"("status", "createdAt");
CREATE INDEX "users_role_organizationId_createdAt_idx" ON "users"("role", "organizationId", "createdAt");
CREATE INDEX "study_sessions_studentId_completedAt_idx" ON "study_sessions"("studentId", "completedAt");
CREATE INDEX "self_quiz_attempts_createdAt_idx" ON "self_quiz_attempts"("createdAt");
