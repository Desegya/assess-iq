# Nightklass WAEC/JAMB extension — implementation report

> **Update, 22 October 2026 (evening):** parts of this document are superseded.
> - `main` up to `4d85ecb` **was pushed**, and Vercel deployed the exam-extension frontend to production. The Railway API had not yet updated.
> - The test counts, rate-limiting behaviour and several limitations below changed during launch-readiness remediation.
>
> Current status: [07 audit](07-launch-readiness-audit.md), [08 release and operations runbook](08-release-and-operations.md) and [09 remediation report](09-remediation-report.md).

Prepared: 22 October 2026  
Implementation baseline: `9abdd32`; updated with automatic PDF timetable extraction.
Status: Text-based pilot software implemented and locally verified; content preparation and production launch remain.

## 1. Outcome

We extended Nightklass to serve Nigerian secondary-school students and school leavers preparing for WAEC/WASSCE and JAMB/UTME. This uses the existing account, learning tools and personal subject workspaces. It does not require a separate application or imply that a learner attends secondary school and university simultaneously.

The completed software supports an end-to-end text-based journey: set up an exam goal, choose subjects, access teacher materials and syllabus objectives, study and practise, take a timed mock, review results, and return to weak objectives. Administrators can manage shared content, publish examination specifications, set exam windows and upload WAEC timetables.

Science, arts/humanities, commercial and other applicable subject choices remain in scope. We did not restrict the product to English, Mathematics, Physics and Chemistry. The software accepts broad subject choices; this does not mean a complete reviewed syllabus, question bank or supported paper format has already been supplied for every subject.

## 2. Product decisions carried into implementation

| Decision | Result |
| --- | --- |
| Keep one account and learning engine | Exam preparation reuses personal courses, topics, lessons, quizzes, flashcards and planning. Existing tertiary details and history are retained. |
| Support secondary learners and school leavers | Onboarding collects the relevant stage without requiring university programme or level fields. |
| Allow WAEC, JAMB or both | Learners maintain distinct exam goals while reusing personal subject workspaces. |
| Keep subject access broad | Teacher materials, learner uploads and syllabus-based generation can support different subject paths. |
| Persist generated questions | Shared generation saves draft bank items for review and reuse. Personal practice remains available through the existing learning engine. |
| Preserve institutional boundaries | Dedicated standalone exam models avoid repurposing organization-bound assessments or expanding institutional teacher privileges. |
| Make dates administratively manageable | Versioned exam calendars and WAEC timetable uploads are now part of the content workspace. |

## 3. Learner experience delivered

### Account, onboarding and goals

Learners can choose secondary/exam preparation and record their secondary stage or school-leaver status. They can save WAEC/JAMB goals for an examination year, select subjects and edit those choices later. JAMB setup includes Use of English and three other subjects. WAEC goals distinguish school candidates, private first series and private second series.

Goal access is owner-scoped. Editing goals preserves existing learning progress. Subject setup reuses personal workspaces rather than creating separate copies of the same subject for every goal. Existing tertiary profiles and study records remain valid.

### Study and practice

The extension connects exam subjects to Nightklass's existing lessons, subject chat, private uploads, topic practice, flashcards and study availability/planning. The existing learning engine is reused rather than rebuilt as a second exam-only engine.

Learners can access published teacher materials and reviewed questions for their subjects. Draft shared materials and questions remain unavailable to them. Learner-uploaded notes stay within the personal course workflow and are not automatically copied into the shared bank.

Published syllabuses expose learning objectives and coverage indicators. A learner can open an objective to establish or reuse a personal study topic, study it and practise it. Objective-specific practice feeds the existing topic mastery and adaptive-planning loop. Coverage also presents relevant mock evidence and links back to weak objectives.

Same-name objectives within a subject can reuse a personal topic. Differently named objectives are not automatically declared equivalent across examinations. Coverage reads bounded recent history, currently up to 500 quizzes and 100 mock attempts for the queried scope; it is a study indicator rather than an exhaustive academic transcript.

## 4. Teacher and administrator tools delivered

The collaborating teacher can use the standalone Nightklass admin workspace after receiving a Nightklass ADMIN/OWNER grant. An institutional TEACHER role alone does not grant this access.

### Materials and reviewed question bank

Administrators can enter notes or upload supported text-based PDF, DOCX, PPTX and TXT teaching files up to 5 MB, inspect extraction, record source/permission information and publish reviewed material. This teaching-material workflow stores extracted shared text; it does not retain the original uploaded binary. WAEC timetable uploads have a separate workflow that does retain the original file.

Question generation can use teaching material or a subject/topic without lecture notes. Generated shared questions are validated and saved as drafts. Administrators can review and edit answers, options, explanations, difficulty, marks and rubrics before publication. Structural validation and duplicate fingerprints help reject defective output, but do not establish factual correctness.

Approved questions are protected from direct editing. A correction creates a linked replacement draft; publishing it archives its predecessor. Historical quiz and mock snapshots preserve their original question content and answer keys. Archiving prevents use in new practice/forms without rewriting old results.

### Syllabuses and objectives

Administrators can author versioned syllabuses, record sources, distinguish curated structures from verified official material, create objectives, map questions to those objectives and publish reviewed versions. Published versions are immutable; replacement publication preserves history and retires the previous current version.

No official syllabus dataset was fabricated or pre-published. The teacher still needs to enter and verify the applicable examination-year content.

### Durable generation

Shared question generation runs through database-backed jobs with idempotent requests, processing leases, bounded retries and visible status. Limits currently allow up to 10 pending batches per creator and up to 10 questions per batch. Workers recheck live administrator access. Saving validated draft questions and completing the job occur atomically, supporting recovery after interruption without treating an unfinished request as a finished bank.

## 5. JAMB timed mocks delivered

Administrators can publish year-specific mock specifications with question counts, duration, instructions and a source/verification note. Baseline fields support 60 English questions, 40 for each of three other subjects and 120 minutes overall; these are editable settings and require verification for the applicable cycle.

The learner flow includes:

- Content availability checks and clear shortfalls before starting.
- Complete configured four-subject form assembly, with a frozen specification and question snapshot.
- Timed question navigation, subject navigation and review flags.
- Saved answers, confirmed-save feedback, refresh recovery and resume.
- Submission review, stable finalization and results with explanations.
- Explicitly labelled practice estimates rather than official JAMB results.

The server owns the deadline. Disconnection does not pause it. Save requests validate the owner, question membership, attempt state and answer revision. Late answers are rejected. Repeated start/submission requests and concurrent finalization are handled without producing duplicate final results. Active mock payloads exclude answer keys, explanations and marking rubrics.

A database-backed sweep finalizes expired attempts even if the browser is closed. Processing runs at API startup and on a recurring sweep; the deployed API must remain running for timely background work. This supports recovery and reconnect, not full offline examination completion.

## 6. WAEC papers and written marking delivered

WAEC paper definitions are scoped by examination year, candidate series, subject and paper. Administrators can configure duration, instructions, source notes and sections, including compulsory questions and optional selections. The software checks the reviewed bank against section requirements before starting a paper.

Supported text papers can combine objective and written sections. Learners can save written responses and answer multipart questions in a combined response with labelled working/subparts. Optional-selection rules are validated. Started attempts freeze their paper configuration and question content.

Written marking uses rubrics and supports partial credit. Marking work persists independently of the initiating request, with recovery, bounded retries and visible failure/ungraded states. Exhausted retries do not silently turn unmarked answers into zero or invent a completed final percentage. Results remain practice feedback, not official WAEC grades.

We also added a calibration report utility at `apps/api/scripts/exam-marking-calibration.cjs`. It compares supplied teacher/AI score pairs and reports error, bias and agreement measures. No real teacher-marked calibration dataset was provided, so real marking accuracy has not been established.

## 7. Exam dates and WAEC timetables delivered

Administrators can create calendars by exam, year and candidate series, set a start date and optional end date, record a verification note, save drafts and publish reviewed versions. Date validation rejects impossible dates, reversed windows and incompatible series. Stale revisions conflict rather than silently overwriting another edit. Publishing a replacement archives the previous published calendar for that scope.

For WAEC, administrators can upload original PDF or CSV timetables up to 5 MB:

| Input | Implemented behavior |
| --- | --- |
| PDF | Retains the original, extracts readable text through the AI engine, validates and saves draft paper dates/times, and fills the draft exam window from those rows. The admin reviews and corrects results before publication. Scanned/unreadable PDFs or invalid/failed extraction show a warning and require manual entry or CSV; replacement failures clear old rows. |
| CSV | Retains the source and imports draft subject/paper/date/time rows for review. Uses explicit ISO dates and optional 24-hour times. |

Uploads do not publish automatically. Structured rows include subject, paper code, title, date, optional start/end times and notes. Paper dates must fall within the configured window. Times are presented as Nigeria time (`Africa/Lagos`); countdowns use the Lagos calendar day.

Learners see published calendars matching their exam year and WAEC series, their selected subjects' paper rows and the original timetable link. JAMB calendars are clearly labelled as general examination windows; personal sitting appointments come from candidates' examination slips.

Learners can explicitly generate a study plan using the earliest future published subject paper date, falling back to the future exam-window start. Manually supplied dates or plan lengths take precedence. Calendar updates do not silently replace personal plans or remove completed study sessions.

Existing WAEC goals were migrated to the school-candidate series, which learners can change through their goal setup.

## 8. Architecture, database and access controls

The backend remains the shared Nest API; the learner and admin interfaces remain in the existing Nightklass Next.js application. Prisma/PostgreSQL stores the new standalone exam domain.

Added domain areas include exam goals/subjects, shared materials and bank questions, JAMB mock specifications/attempts, WAEC paper templates, syllabuses/objectives and mappings, generation jobs and exam calendars. The implementation reuses storage, authentication, AI and personal learning services behind the applicable access checks.

Shared content uses explicit draft/publication states. Learner APIs enforce ownership; admin operations require active standalone grants, and sensitive mutations recheck grants inside their transactions and write audit records. The admin server proxy retains its path allowlist, same-origin mutation checks and protected admin session handling. A browser-discovered local-hostname normalization issue in the origin check was fixed and verified during this work.

All **20 repository migrations** are applied to local development PostgreSQL. This is the total migration count, including earlier repository migrations, not 20 new migrations for this extension. The generated Prisma client was refreshed. The isolated exam test database was also migrated. No production database was migrated.

## 9. Verification completed

These are the latest recorded local results from implementation, not fresh test runs performed while writing this report.

| Check | Recorded result |
| --- | --- |
| Backend unit tests | 90 passing |
| Real HTTP/PostgreSQL integration tests | 29 passing |
| Browser cases | 14 passing across desktop Chrome and mobile emulation |
| API production build and TypeScript checks | Passing |
| Nightklass production build and type validation | Passing |
| Local development migrations | All 20 applied |

Integration coverage includes a complete 180-question JAMB fixture, ownership and publication permissions, frozen answer keys, stale saves, concurrent submissions, expiry/late-save handling, WAEC optional sections, marking retries/exhaustion, syllabus coverage, correction history, generation idempotency, PDF date persistence and extraction-failure recovery, CSV timetable uploads, series isolation and published-date study planning.

Browser coverage includes secondary onboarding, teacher syllabus publication and generation, objective practice/evidence, keyboard activation, viewport fit, JAMB answer recovery/submission, WAEC essays and admin-to-learner timetable publication with original-file download. The existing 12 cases passed; the two new desktop/mobile timetable cases passed after correcting a test dropdown selector.

Mobile tests emulate a viewport in Chromium; they are not physical-device or Safari verification. AI responses in automated generation/marking tests are deterministic stubs. A five-request concurrent-read smoke check completed in 116 ms locally; this is not a production capacity benchmark.

A GitHub Actions workflow now provisions isolated PostgreSQL and runs backend tests, integration checks, the frontend build and browser flows. It has been committed locally; no remote CI execution is claimed because this work has not been pushed.

## 10. Commits and documentation

Implementation was split into focused local commits:

| Area | Commits |
| --- | --- |
| Approved extension plan | `c9c3880` |
| Profiles, goals and onboarding | `344a794`, `bdba1c2` |
| Shared materials, reviewed bank and practice | `ff50b7b`, `86552e1` |
| Durable JAMB mocks and runner | `9edfbcd`, `0b429ae` |
| WAEC sections, written marking and interface | `acba7a9`, `35d48ab` |
| Syllabuses, corrections, generation jobs and revision flows | `0180cbe`, `3aa9ac4` |
| Browser automation and CI | `24959bc` |
| Exam calendars and timetable experience | `cc29103`, `9abdd32` |
| Migration, operating and release documentation | `49a75c0`, `bfc1932`, `aa7541a`, `4d85ecb` |

Supporting documents:

- [Implementation plan](04-waec-jamb-extension-plan.md): approved direction and current implementation status.
- [Pilot release checklist](05-release-readiness.md): content gates, deployment needs and explicit limits.
- [Admin guide](../../apps/nightklass/ADMIN.md): access provisioning, content operations, mocks, testing and timetable instructions.
- [Prisma schema](../../packages/db/prisma/schema.prisma): implemented data models.
- [Verification workflow](../../.github/workflows/nightklass-exams.yml): committed CI configuration.

Nothing was pushed or deployed as part of this work.

## 11. Remaining work and release readiness

The text-based pilot software is implemented. A public launch still depends on the following concrete work:

1. **Populate and review content.** Enter the applicable syllabuses, publish verified exam specifications, upload teacher materials and supply enough reviewed questions for each advertised complete mock across intended subjects.
2. **Publish verified dates.** Enter the applicable exam windows and WAEC timetables, review structured rows and maintain published replacements when dates change. No real exam dates were invented or preloaded.
3. **Validate real AI output.** Review representative lessons/questions and compare written marks against an independently teacher-marked sample across subjects and ability levels.
4. **Prepare deployment.** Apply migrations in the target environment, configure HTTPS/origins/storage/AI settings, provision administrator access and backups, and keep background processing operational.
5. **Run an invited pilot.** Monitor content errors, save failures, marking retries, learner feedback and AI costs; benchmark the intended deployment at the agreed cohort concurrency before expanding access.

Later engineering enhancements remain: rich passages/assets, diagrams/audio, practical/oral interactions, separate subpart answer/score controls, detailed question-distribution blueprints, curated cross-exam equivalence and automatic mock-to-plan objective updates. Native apps, full offline mocks, parent/school dashboards and new billing flows remain outside this release.

The delivered capability is a locally verified text-based exam-preparation platform. Complete subject coverage, official exam authenticity, calibrated grading accuracy and production readiness must be established through the content and release work above.
