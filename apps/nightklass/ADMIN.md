# Nightklass administration

The admin lives at `/admin` in the existing Nightklass frontend. It uses scoped
product components and a dedicated layout; the landing page and KwikEval frontend
are unchanged. The shared Nest API serves `/api/v1/admin/nightklass/*`.

## Deployment and first owner

1. Generate the Prisma client and deploy migrations using the existing database
   workspace commands. The new migration adds admin grants, audit records, report
   resolution fields, and query indexes.
2. Build the API and Nightklass. Set `API_URL_INTERNAL` on the Nightklass server to
   the full API base URL, including `/api/v1`. It falls back to
   `NEXT_PUBLIC_API_URL`, then the existing local API URL.
3. Use an existing **active standalone Nightklass account** for the first owner.
   From a trusted deployment shell with `DATABASE_URL` already exported, run:

   ```sh
   node packages/db/scripts/bootstrap-nightklass-admin.cjs owner@example.com
   ```

   This does not create credentials or change shared institutional roles. It
   refuses to run if any administrator is already provisioned. The grant and
   audit entry are atomic, and existing refresh sessions are revoked.
4. Sign in at `/admin/login` with that account’s existing password. Owners can
   grant ADMIN or OWNER access to other active Nightklass accounts from Learners.
   Administrators can manage content and learner status, but cannot manage grants.

Use HTTPS in production. Admin sessions use separate HTTP-only, Secure,
SameSite=Strict cookies; privileged tokens never reach browser JavaScript or
localStorage. The server proxy checks Origin for mutations, limits paths and body
sizes, retries an expired access token using the existing refresh mechanism, and
prevents caching responses. Authenticated API requests still require a bearer
JWT and a current, active, standalone database admin grant. Mutations recheck the
actor inside their transaction. Revoked grants take effect on the next request.

Login endpoints are rate limited. The existing shared login previously declared
limits without installing its throttle guard; this is now enforced on login.
Deploy API rate limiting behind a correctly configured trusted reverse proxy if
per-client IP attribution is required. The frontend proxy’s login requests share
its server egress address at the API; limits currently apply to that address.

## Modules and boundaries

- **Overview:** real database counts, rolling 30-day registration and learning
  activity, quiz scores and recorded AI usage/cost, recent administrative actions.
  Active means a completed study session, mastery assessment, or flashcard review
  in that window. Counts exclude institutional accounts and courses.
- **Learners:** server search, status filtering and pagination, safe account
  details, recent course/session support context, course creation for an active
  learner, suspend/inactivate/restore, owner-managed admin grants.
- **Courses & topics:** course metadata, paginated outlines, topic creation,
  editing and ordering, archive/restore of topic trees with preserved history.
  Course and topic edits reuse the domain services inside an audited transaction.
- **Lessons:** version listing, original preview, introduction/section/summary
  corrections saved as a new version. Other lesson fields and source references
  are preserved; stale or historical-version edits conflict.
- **Questions:** personal quiz question listing, all four existing question types,
  options, model answers, difficulty, marks, explanations, and existing statuses.
  Questions referenced in graded self-quiz attempts cannot be modified. This does
  not introduce a shared question bank or alter fresh quiz generation.
- **Materials:** upload processing metadata, search and status filtering. No raw
  extracted text, private file URLs, or storage credentials are exposed.
- **Learning activity:** searchable, paginated study-session records.
- **Content reports:** review lessons, resolve/dismiss/reopen with a recorded
  reason. Changing report status does not silently rewrite its lesson.
- **Audit history:** trusted server-generated security and content actions;
  no API for editing or deleting audit records.
- **Admin access:** bounded team listing (100 accounts); only owners change grants.

No global published-course catalog, mutable platform configuration, Nightklass
billing, announcements, or mass notification capability exists in the audited
product. There are no placeholder modules for these. There is no impersonation,
account deletion, or destructive material/course deletion in the admin.

## Verification

```sh
npm run db:generate --workspace @assessiq/db
npm run type-check --workspace @assessiq/api
npm run type-check --workspace @assessiq/nightklass
npm run test --workspace @assessiq/api
npm run build --workspace @assessiq/api
npm run build --workspace @assessiq/nightklass
```

Run real HTTP/PostgreSQL tests only against a **disposable database named
`nightklass_admin_test`**, after applying all migrations:

```sh
DATABASE_URL=<isolated-test-database-url> npm run test:admin:integration --workspace @assessiq/api
```

The tests add uniquely named fixtures; they do not reset or delete database rows.
They cover authentication, authorization, tenant isolation, validation, pagination,
content mutations, access management, conflicts, audit persistence, token
invalidation, and existing institution contracts. Destroy the disposable database
when finished. No live deployment or production data is required by the tests.

The standard lint commands currently require repository ESLint setup (the API
lacks an executable, and Next prompts for configuration). Temporary external
ESLint checks can validate the changes without upgrading repository dependencies.
The API build uses a nonincremental build config to avoid missing JavaScript
outputs when a preceding no-emit type check writes incremental state.
