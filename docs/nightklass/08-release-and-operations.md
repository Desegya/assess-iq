# Nightklass release and operations runbook

Last updated 22 October 2026 with branch `fix/nightklass-launch-readiness`. This runbook replaces the deployment sections of documents 05 and 06 wherever they differ.

## 1. Where things stand (checked 22 October 2026)

| Item | State | How it was established |
| --- | --- | --- |
| Frontend (Vercel, `nightklass.com`) | **Live from `main` at `4d85ecb`.** It includes the exam-extension UI. Production deployment created at 16:50 WAT. | `vercel ls` and `vercel inspect` (read-only). |
| API (Railway, `assessiq-api-production.up.railway.app`) | **Runs a version older than the exam extension.** Every exam route returns 404; existing routes return 401. The owner reports a Railway incident blocked the deployment. | Unauthenticated GET probes. `railway` CLI was not logged in. |
| Production database migrations | **Unknown.** If Railway's deploy started, `prisma migrate deploy` may have run partly, because the Dockerfile runs it on container start. | Not inspectable from this workspace. |
| Frontend/API mismatch | The live onboarding page sends `studyPathway`. An API from before `344a794` rejects unknown fields, so **new-user onboarding on production very likely fails until the API catches up.** | Code comparison. Not reproduced, because that would create production data. |
| Remote CI | Not verified. `gh` is not installed here, and nothing from this branch has been pushed. | — |

**Operator checks before any release (read-only):**

1. Railway dashboard → API service → Deployments: identify the active deployment's commit and the status of the most recent attempt.
2. Production database (read-only role): `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;`
   - A row with `finished_at IS NULL` and `rolled_back_at IS NULL` is a failed migration. Do not deploy over it; resolve it first with `prisma migrate resolve`, reviewing the SQL by hand.
3. Production frontend: `vercel ls nightklass` and confirm which commit is live.
4. If the frontend is ahead of the API and onboarding is failing, the fastest containment is promoting the previous Vercel production deployment (`vercel rollback` or dashboard → Promote). Deploying the matching API is the alternative.

## 2. Release gates

**The deployment trigger is a push to `main`:** Vercel deploys the frontend immediately, and Railway builds the API and applies migrations on start. So:

- **Protect `main`** (GitHub → Settings → Branches): require a pull request, require the `Nightklass exam preparation / verify` check to pass, and disallow force pushes. *Owner action; not verifiable from this workspace.*
- Merge only from a reviewed PR whose CI run is green.
- The CI workflow (`.github/workflows/nightklass-exams.yml`) runs:
  - `npm audit --audit-level=critical`
  - `prisma validate` and `migrate status`
  - type checks for both apps
  - API unit tests and Nightklass unit tests (`node:test`)
  - the exam and security HTTP/PostgreSQL suites
  - the admin HTTP/PostgreSQL suite on its own database
  - the Nightklass production build
  - Playwright on desktop and mobile emulation

## 3. Production configuration

The API **refuses to start** in production (`NODE_ENV=production`) when a required value is missing or unsafe (`apps/api/src/environment.ts`).

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | yes | Each at least 32 characters, and different from each other. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME` | yes | No local-disk fallback in production. |
| `R2_PUBLIC_URL` | **must be unset** | All objects are private; downloads use presigned URLs that expire after 5 minutes. **If it is currently set in Railway, remove it before deploying, or the API will not start.** |
| `APP_URL` | yes | Comma-separated `https://` frontend origins (CORS). |
| `TRUST_PROXY` | strongly recommended | Railway: `1`. Without it, anonymous rate limits key on the proxy address. `true` is rejected. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | for AI | Without them, AI features return an error and nothing else is affected. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Password reset and email verification. Without them, emails are not sent, which is logged as `event=password_reset_email_failed`. |
| `PASSWORD_RESET_URL` | for email | e.g. `https://nightklass.com/reset-password`. The verification link is derived from it (`/verify-email`). |
| `EXAM_ACCESS` | no (default `COHORT`) | `COHORT` = invited learners only; `OPEN` = all standalone learners. |
| `EXAM_NEW_ATTEMPTS_PAUSED` | no (default `false`) | Emergency brake on new mock starts. |
| `AI_PAUSED` | no (default `false`) | AI kill switch. |
| `AI_USER_DAILY_BUDGET_USD` | no (default 0.50) | Rolling 24 h, per learner. |
| `AI_ADMIN_DAILY_BUDGET_USD` | no (default 5) | Rolling 24 h, per content admin. |
| `AI_USER_DAILY_REQUESTS` | no (default 200) | Admins get 10×. |
| `AI_GLOBAL_DAILY_BUDGET_USD` | no (default 25) | Rolling 24 h, everyone. |

All `EXAM_*` and `AI_*` values can also be changed at runtime by an OWNER on **Admin → Operations**. Those changes are stored in `runtime_settings` and audited, and take effect within about 5 seconds without a redeploy.

Frontend (Vercel):

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Must be set at **build** time. It also sets the CSP `connect-src`, so changing the API host requires a rebuild. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Shown in the privacy notice. Until it is set, the notice says the contact is being set up. **Launch blocker.** |
| `API_URL_INTERNAL` | Optional; used by the admin server proxy. |

## 4. Migrations in this release

These are applied automatically by the API container on start (`prisma migrate deploy`). Review them in the PR.

| Migration | What it does | Risk and lock profile |
| --- | --- | --- |
| `20261023100000_launch_readiness_security` | Adds tables and columns (all nullable or defaulted). Adds enum values. **Hashes existing refresh tokens in place** (`sha256`), so signed-in users stay signed in. | Brief `ALTER TABLE` locks on `users`, `refresh_tokens`, `ai_usage_logs` and `exam_bank_questions`. The token update touches every refresh token row (small table). Safe to re-run. |
| `20261023110000_privacy_acknowledgement` | Two nullable columns on `users`. | Trivial. |
| `20261023120000_canonical_subject_keys` | Re-keys rows stored under subject aliases (e.g. `crk`), skipping conflicts. | Row updates only; a no-op when nothing uses aliases. Safe to re-run. |

**Compatibility during rollout:**

- The previous API ignores the new columns.
- The new API accepts the old frontend: `privacyNoticeVersion` is optional, and the session marker accepts legacy cookies.
- Refresh tokens issued by the old API but presented after the migration are matched by digest.

**Rollback:** do **not** roll back these migrations; they are additive. If the new API must be rolled back, redeploy the previous image.

- The hashed refresh tokens will no longer match the old API's raw lookup, so learners will need to sign in once.
- Everything else keeps working.

## 5. Activating the pilot safely

1. Deploy with `EXAM_ACCESS=COHORT` (the default) and `TRUST_PROXY=1`.
2. Admin → Operations → **Pilot cohort**: add each invited learner by their account email.
3. For each advertised subject, complete the content gates in section 9.
4. Watch Admin → Operations → *Needs attention* during the first sessions.
5. To widen access later, switch exam access to `OPEN`.

**Emergency controls** (Admin → Operations, OWNER only, audited):

| Situation | Action | Effect |
| --- | --- | --- |
| AI cost spike or provider misbehaviour | Turn on **Pause all AI features** | No provider calls. Submitted written answers wait and are marked when AI resumes; their retry attempts are not consumed. |
| Problem with mock assembly or content | Turn on **Pause new mock starts** | No new attempts. Learners in a mock can still save, submit and see results. |
| Exam area must close to non-pilot learners | Set exam access to `COHORT` | Server-side 403 for learners not in the cohort. |
| Bad question in circulation | Publish a correction (archives the original) | New forms stop using it. Coverage stops counting old results on it. Historical attempts keep their snapshot. |

## 6. Post-deployment smoke test

Use a test learner account; never a real learner's.

1. `GET /health` → `{"status":"ok"}`; `GET /health/ready` → `{"status":"ready"}`.
2. `GET /api/v1/exam-preparation/access` with a learner token → `available` matches the cohort setting.
3. Register → confirm via the verification email → sign out → "Forgot password?" → reset → sign in.
4. Exam area (as a cohort member): start a mock → answer → see "Saved at …" → reload → resume → submit.
5. Admin → Operations shows zeros under *Needs attention*, and AI usage appears.
6. Account → Download my data produces a file.
7. Response headers on `nightklass.com` include `Content-Security-Policy`. API responses include `X-Content-Type-Options: nosniff`.

## 7. Monitoring and alerting

There is no external error tracker in the project, and none was added without credentials. Signals available today:

- **Admin → Operations → Needs attention**:
  - attempts past their deadline and not finalized
  - written marking older than 10 minutes
  - marking or generation failures in the last 24 h
  - open learner reports
- **AI usage**: 24 h spend by action, failures, and top users (`/admin/nightklass/operations/ai-usage`).
- **Structured log events** (Railway log search or alerts):
  - `event=refresh_token_reuse`
  - `event=ai_global_budget_reached`
  - `event=ai_user_quota_reached`
  - `event=ai_call_failed`
  - `event=written_marking_retry` / `written_marking_failed` / `written_marking_deferred`
  - `event=password_reset_email_failed`
  - `event=runtime_setting_changed`
  - `event=account_deleted`
  - `event=account_file_delete_failed`
- **Health**: point Railway's health check at `/health/ready`.

Logs never include tokens, passwords, answer text or uploaded content. They include user IDs and attempt IDs.

**Recommended before public launch:** an error tracker (e.g. Sentry) wired into a Nest exception filter, plus alerts on the events above. That needs credentials and is not done.

## 8. Backup and restore

- **Production:** Railway's PostgreSQL backups are configured in the Railway dashboard. Their schedule and retention are **not verified** from this workspace; the owner must confirm them.
- **Rehearsed locally** (see document 09): `pg_dump -Fc`, then `pg_restore` into a new empty database, then `prisma migrate status` and row-count comparison.

**Restore runbook** (never restore over the live database):

1. Create a **new** database (Railway: new PostgreSQL service, or `CREATE DATABASE nightklass_restore_<date>`).
2. Restore the chosen backup into it: `pg_restore --no-owner --no-privileges -d <new-db-url> <dump>`, or use Railway's restore-to-new-service option.
3. `DATABASE_URL=<new-db-url> npx prisma migrate status` must report the database as up to date.
4. Compare key counts with the live database: `users`, `exam_mock_attempts`, `exam_bank_questions`, `courses`.
5. Point a **staging** API at the restored database and run the smoke test.
6. Only then, during a maintenance window, switch production `DATABASE_URL`. Pause new mock starts first and let in-progress mocks finish.

## 9. Per-subject release inventory

A subject or paper may be advertised to the pilot only when every row below is complete. Readiness of one subject says nothing about another. Keep one copy of this table per subject or paper.

| Gate | Evidence required | Status |
| --- | --- | --- |
| Syllabus | Published syllabus for the exam year. Provenance OFFICIAL only with the source checked; otherwise CURATED. | ☐ |
| Specification | JAMB template or WAEC paper checked against the current cycle's official source and recorded in its source note. | ☐ |
| Dates | Published calendar/timetable rows checked against the official timetable. | ☐ |
| Question supply | At least **2 distinct complete forms** of reviewed questions (so a retake is not the same paper). Coverage of the syllabus objectives is mapped. | ☐ |
| Review | Every published item human-reviewed; duplicate warnings (`/similar`) checked. | ☐ |
| Format disclosure | The subject's paper does not depend on passages, diagrams, practicals or orals for a large share of marks, or learners are told explicitly. | ☐ |
| Written marking | Calibration verdict `CALIBRATED` for the subject, or written marks presented as indicative (the current default). | ☐ |
| Corrections | A named teacher monitors learner reports and corrects within 72 h. | ☐ |
