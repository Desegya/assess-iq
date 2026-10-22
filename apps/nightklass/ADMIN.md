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


## WAEC/JAMB content and JAMB practice mocks

Open `/admin/exam-content` using a Nightklass ADMIN/OWNER account. Grant the collaborating teacher access through the existing owner-managed access screen; an institutional TEACHER role does not grant this standalone product permission.

Choose any subject and topic. Paste notes or upload a text-based PDF, DOCX, PPTX or TXT file up to 5 MB. Files are extracted into shared text records; original binaries are not retained by this workflow. Provide the source and permission to share, preview extraction, then publish the material when ready.

Generate small original-question batches from a topic alone or selected teaching material. Output is validated and saved as drafts. Review answers and explanations, edit drafts, then approve individual questions. Approved questions cannot be edited directly; create a correction or archive defective items. Use “Create correction” on a published question to create a linked draft. Publishing that draft archives the predecessor; historical quiz/mock copies retain their original content. These are exam-style questions unless separately sourced as actual permitted past questions.

Learners open “Teacher notes & reviewed practice” from their subject cards. Private learner uploads remain in the existing personally owned course workflow and are not copied into this shared bank.

Publish a JAMB mock specification for the intended examination year after checking the rules and recording a source/verification note. The default form fields follow the published baseline: 60 English questions, 40 in each of three other subjects and 120 minutes overall. They are editable configuration, not an automatically verified specification for any future cycle. A full mock requires the configured number of approved questions in every selected subject. Scores are explicitly labelled practice estimates, not official JAMB scoring.

The API finalizes overdue attempts at startup and through a 30-second database-backed sweep. Keep the API running for timely finalization; a read also finalizes an overdue attempt. Confirmed answers survive refresh; unsaved changes require the page to stay open and connectivity to return. The server deadline continues during disconnection. Text-based WAEC paper mocks are configured in the same content workspace; practical/oral interactions are not supported.

Run the dedicated integration suite only against the isolated local database named `nightklass_exam_test`, with committed migrations applied:

```sh
DATABASE_URL=<isolated-test-database-url> npm run test:exam:integration --workspace @assessiq/api
```

The suite starts the actual API, uses real authentication and PostgreSQL, and creates test fixtures. It checks content visibility, uploads, question publication, practice, a full 180-question mock, answer ownership/versioning, concurrent submission and expiry recovery. It does not call paid AI or external storage. Fixtures remain in the disposable test database; core bank fixtures use per-run identities to avoid collisions.


### WAEC text-based papers and written marking

Use “WAEC paper specifications” in `/admin/exam-content` to create or edit a subject/year/series/paper. Record a source and verification note; do not treat a sample configuration as an official specification. Each section defines its type (MCQ, short answer or theory), question count, questions to answer, marks per question, and optional exact bank topic. All questions are compulsory when count equals questions to answer. Objective items currently carry one mark; written items must match the section's configured marks.

Publish reviewed WAEC bank questions with model answers and explanation/marking points. For multipart prompts, write labelled subparts in the question and model answer and specify combined marks. The learner currently writes one combined response; marking reports an aggregate question score and feedback. Separate subpart scoring is not implemented. Do not advertise unsupported practical, diagram-dependent or oral papers as complete mocks.

Learners open “WAEC paper mocks” on their exam goal, choose the applicable series and paper, and select optional questions explicitly. Submitted answers are frozen. The API marks objectives immediately and stores pending written work in PostgreSQL. It claims marking work with a lease, processes five answers per batch, saves partial feedback, and retries provider failures after one minute. After three failed provider attempts, unanswered written grading remains visibly ungraded with no invented final percentage. A startup/30-second sweep recovers pending work; keep the API running to process it.

The exam integration suite now includes mixed WAEC objective/essay papers, optional selection enforcement, multipart prompt/combined answer persistence, partial rubric credit, marking recovery, expiry with incomplete selections and retry exhaustion. The marking provider is stubbed for these tests. Calibrate real AI feedback against teacher-marked examples before public launch.


### Syllabus versions, objective coverage and generation jobs

In `/admin/exam-content`, use “Syllabuses and learning objectives” to create a draft for an exam/year/subject/version. Enter one objective per line as `code | title | learning objective`. Classify teacher-authored structures as CURATED. OFFICIAL requires a source URL and a genuine source/applicability review by the publisher. Save the draft, check its objectives, then publish. Publishing a new version archives the previous active version in the same scope. Published records cannot be edited; copy them into a new version.

Select matching syllabus objectives when generating or authoring questions. Draft questions can change objective mappings; published corrections inherit their predecessor's mappings. The learner's “Syllabus & coverage” page shows reviewed practice availability, recorded study and recent practice evidence, with links to study or practise each objective. Objective-specific practice uses the normal private study topic so quiz results participate in the existing adaptive planner. Untested objectives remain explicitly unassessed.

The generation button now queues a server-side job. Up to 10 batches can be pending per creator, with at most 10 requested questions per batch. Status and counts appear under “Generation batches.” The API claims work with a five-minute lease, retries failures after one minute, and stops after three provider attempts. Administrator access is rechecked before work and during the save transaction. Successful draft insertion and job completion commit together. Keep an API process running; closing the browser does not cancel the job.

Compare anonymized independent teacher and AI marks with:

```sh
node apps/api/scripts/exam-marking-calibration.cjs /path/to/paired-scores.json
```

The API must be built first. Each JSON sample contains `questionId`, `maxMarks`, `teacherScore`, and `aiScore`. The report measures disagreement for those samples only; no real calibration dataset was supplied during this implementation.

### Browser verification and release

Apply migrations to the isolated local `nightklass_exam_test` database and build the API before running:

```sh
DATABASE_URL=<isolated-local-test-database-url> npm run test:e2e --workspace @assessiq/nightklass
```

Local runs use installed Google Chrome. The tests start their own API on port 3101 and Next frontend on port 3102, create isolated test accounts, use deterministic AI stubs, and run desktop plus mobile-emulation projects. The fixture server refuses nonlocal or differently named databases. Test artifacts are ignored by Git. Do not run a frontend production build/type check concurrently with this development server, because they share Next's generated output directory.

CI uses bundled Chromium and an isolated PostgreSQL service. The added workflow verifies backend tests, full API/database tests, the frontend build and browser flows; no GitHub run is claimed until it is pushed and inspected.

Final local verification: 82 unit tests, 24 API/database integration tests and 12 browser cases pass; both production builds pass; all 19 local migrations are current. The five-request concurrent-read smoke check took 54 ms locally and is not a production benchmark. See [the pilot release checklist](../../docs/nightklass/05-release-readiness.md) for teacher content validation, marking calibration, deployment, monitoring and explicitly unsupported formats.
