# Nightklass WAEC and JAMB extension — implementation plan

Status: Approved direction; implementation in progress.  
Prepared: 22 October 2026.  
Scope: Nigerian secondary-school learners and school leavers preparing for WASSCE and UTME, within the existing Nightklass product.

## Implementation status — 22 October 2026

First foundation slice implemented:

- Additive learner-pathway and secondary-stage migration; existing accounts default to tertiary.
- Conditional secondary onboarding for SS1–SS3 and school leavers, with existing academic records preserved.
- Authenticated standalone-learner exam-goal API and subject setup across all subject groups, including custom names.
- One goal per learner/exam/year; transactional saves and conflict handling.
- Personal subject workspaces reused across WAEC/JAMB and repeated setup; removing a choice preserves learning history.
- Exam dashboard and subject navigation wired to existing upload, outline, lesson, quiz, chat, flashcard and planning pages.
- AI course context updated to distinguish secondary subjects from university courses.
- 62 API unit tests pass, including 12 new foundation cases; API build and frontend/API type checks pass.
- Migration checked against Prisma's schema diff and applied to local PostgreSQL (`localhost:5432/assessiq`). All 15 migrations are now applied, including the previously pending admin migration. Database integration and browser testing remain outstanding.
- Frontend production build currently fails fetching existing Google Fonts because the environment cannot resolve fonts.googleapis.com.

Still to implement: official syllabus/version management, teacher-managed shared materials and saved question-bank generation/review, exam specifications, full timed mocks, durable expiry/grading, WAEC paper structures, exam-specific analytics and combined-goal revision. Existing topic quizzes are not full exam simulations. No deployment has been performed. The local development database migration was applied on 22 October 2026.

## 1. Outcome and product direction

Extend Nightklass so a learner can select WAEC, JAMB, or both; study a reviewed syllabus; practise relevant questions; take realistic timed mocks; understand mistakes; and receive a revision plan informed by performance.

Keep one account and one learning engine. Onboarding selects the experience relevant to the learner: secondary/exam preparation or tertiary study. This does not imply simultaneous enrolment in secondary school and university. A school leaver preparing for JAMB can later progress to tertiary study using the same account, retaining exam history and previous progress. No prominent workspace switch is required for every learner. Exam goals are independent of current school enrolment, so school leavers and repeat candidates are supported.

Support subject choices across science, arts/humanities, and commercial paths from the outset; do not hardcode a four-subject science pilot. Build the subject catalogue from the applicable WAEC/JAMB specifications. A collaborating teacher can upload materials for any subject; learners can upload their own notes; AI can generate lessons and questions from materials or syllabus objectives alone. Persist generated questions and grow coverage over time. Sequence engineering by capabilities, not by excluding subject groups. WAEC paper formats still require their own configurations and rendering support.

## 2. Existing foundation and gaps

| Area | Existing implementation | Extension |
| --- | --- | --- |
| Accounts | Standalone learners and academic profiles | Learning pathway, secondary stage, school-leaver status, exam goals |
| Onboarding | Programme, 100–600 level, semester | Conditional secondary onboarding and subject selection |
| Courses/topics | Personally owned courses and editable topics | Published subjects and syllabus versions linked to personal study workspaces |
| Learning | Source-based/AI/combined lessons, chat, resources | Exam objectives and age-appropriate explanations |
| Planning | Availability, multi-course allocation, mastery adaptation | Exam goals, subject priorities, deduplicated revision across goals |
| Practice | Topic quizzes, written feedback, flashcards | Reviewed shared question bank and exam-specific practice |
| Mocks | Institutional assessment/attempt models exist | Dedicated standalone exam definitions and durable attempts |
| Admin | Learner/content management and audit history | Syllabus, question-bank, rubric, and exam-template publishing |
| Progress | Topic mastery, activity, readiness, GPA | Separate exam performance, timing, coverage, and revision dashboard |

Important architecture constraints:

- Nightklass topic quiz generation currently accepts 1–20 questions. Increasing that limit does not produce a full mock engine.
- Institutional `Assessment` requires an organization and a single course. Do not remove those boundaries to accommodate standalone exam preparation.
- Existing `Question` records are tied to creator-owned/institutional workflows. A published exam bank needs explicit access and publication semantics.
- Existing attempts offer useful patterns, but timing, question membership, answer exposure, and finalization must be verified independently before extracting shared helpers.
- Existing university profiles and historical progress must remain valid throughout migration.

## 3. Release scope

### Initial exam-preparation foundation and JAMB mock engine

- Secondary/exam-preparation onboarding, including school leavers.
- WAEC, JAMB and combined goal setup; JAMB candidates choose their applicable four-subject combination across the full configured catalogue.
- Versioned syllabus/objective coverage across the subject catalogue, with visible source and review status.
- Study lessons, subject chat, topic practice, and revision cards.
- Full timed four-subject mock, subject navigation, review flags, autosave, reconnect/resume, and submission.
- Results by subject/topic, explanations, timing observations, and revision recommendations.
- Teacher/admin material uploads, AI generation, question persistence, imports, review and publication across subjects.
- Responsive browser experience, keyboard support, and clear save/connectivity states.

### WAEC release

- WAEC and combined goals, with explicit examination series and year.
- Supported subjects with versioned objective/written paper definitions.
- Compulsory and optional question groups, multipart questions, marks and rubrics.
- Written practice feedback with method/marking-point guidance.
- Paper-level mocks and results; no invented universal WAEC paper structure.
- Diagrams and tables required by the selected subjects.

### Deferred

- Native mobile apps and full offline mock exams.
- School/parent dashboards, classroom management, and tutor marketplaces.
- NECO and international exam boards. All applicable WAEC/JAMB subjects are in scope; unsupported specialist paper interactions must be shown explicitly.
- Live proctoring, biometric identity checks, or webcam monitoring.
- Hands-on laboratory simulation and unsupported oral/audio papers.
- Automated official admission eligibility decisions or guaranteed score predictions.
- Billing changes, unless separately scoped.

A deferred paper type must be visibly marked unsupported. Do not label an objective-only WAEC exercise a complete subject mock.

## 4. Learner journeys

### A. New JAMB candidate

1. Create an account and select exam preparation.
2. Choose SS1/SS2/SS3 or school leaver, target examination year, and JAMB.
3. Select Use of English and three applicable subjects across science, arts/humanities and commercial paths; see content and paper-format availability.
4. Optionally set target score and intended programme. Programme is contextual; do not infer official eligibility from an unverified mapping.
5. Set study availability and a target date. Distinguish learner-entered target dates from verified examination dates.
6. Take an optional diagnostic, clearly identified as diagnostic rather than a full mock.
7. Receive a subject/topic plan and today's tasks.
8. Study, practise, review mistakes, and take scheduled mocks.
9. See progress and revise weak topics.

### B. WAEC candidate

1. Select WAEC, examination year and supported series.
2. Choose subjects using the applicable reviewed rules; preserve incomplete setup as a draft.
3. Study the syllabus and practise objectives or written questions.
4. Take a supported paper with its own instructions, duration, and question-selection rules.
5. Review objective answers and rubric-based written feedback.
6. Revisit missing concepts and weak answer techniques.

### C. Candidate preparing for both

- Store separate goals and subject/paper selections.
- Reuse linked learning topics where objectives overlap, while keeping each exam's coverage distinct.
- Avoid duplicate study sessions for an equivalent learning objective.
- Keep mock results and score scales separate.
- A shared lesson does not automatically establish mastery of both examinations' requirements.

### D. Progression into tertiary study

- Existing tertiary learners continue using the current dashboard and courses.
- A secondary learner or school leaver can later update their academic stage and complete tertiary profile fields.
- Present the relevant dashboard by default and retain historical exam results, materials and revision records.
- Adding an exam goal must not overwrite existing tertiary details; keeping exam history does not imply concurrent enrolment.

## 5. Interface plan

Exam workspace navigation:

- Home: next study task, upcoming mock, due revision, progress by goal.
- Subjects: syllabus tree, materials, lessons, practice and coverage.
- Practice: subject/topic filters, question count, difficulty where reviewed, timed or untimed mode.
- Mock exams: supported templates, readiness requirements, history, resume active attempt.
- Revision: mistakes, weak topics, due flashcards.
- Progress: syllabus coverage, practice accuracy, timed performance, goal history.
- Profile: stage, exam goals, subjects, targets and availability.

Exam runner:

- Instructions and explicit start action before the timer begins.
- Subject/section tabs, numbered question palette, answered/unanswered/flagged states.
- Shared passage and associated questions, diagrams, mathematical notation and tables.
- Countdown, connection indicator, and last confirmed save.
- Submission summary showing unanswered items and applicable section rules.
- Accessible navigation, focus handling, labelled controls and mobile layouts.
- Hints, chat, explanations and answer keys remain outside active mock responses.

A reconnect does not pause the server deadline. Unacknowledged local answers must be visibly distinguished from server-saved answers. No promise of full offline completion in the first release.

## 6. Proposed domain model

Names below are design proposals, finalized during the schema phase.

| Entity | Responsibility |
| --- | --- |
| LearnerStudyProfile | Secondary stage/school-leaver state and active workspace; existing tertiary fields retained |
| ExamGoal | User, exam family, examination year/series, targets, target date and status |
| ExamSubject | Canonical subject identity and display metadata |
| GoalSubject | Selected subject, priority and target within a goal |
| SyllabusVersion | Exam/subject, applicability, source, review/publication state |
| SyllabusObjective | Ordered topic/objective hierarchy within a version |
| StudyTopicLink | Published objective to personally owned course/topic mapping; explicit cross-exam equivalence |
| ExamSpecificationVersion | Exam/series applicability, verified rule sources, scoring policy, publication state |
| PaperTemplate / Section | Duration, subject counts, instructions, selection rules and marks |
| BankQuestion / QuestionRevision | Published question identity and immutable revisions, answer key, explanation, marks and rubric |
| QuestionObjectiveLink | Mapping and weighting for questions spanning multiple objectives |
| QuestionStimulus / Asset | Passages, diagrams, tables and later audio, with provenance and accessible text |
| MockForm / FormItem | Validated assembled questions and frozen ordering for a paper/sitting |
| ExamAttempt | Owner, form/specification versions, start/deadline, state, submission and grading status |
| ExamAnswer | Attempt item, answer payload, save revision, timestamps and grading result |
| GradingRun | Rubric/model version, processing status, feedback and retry history |
| ContentSource / ImportBatch | Source/permission metadata, import validation, review and rollback trace |

Prefer dedicated exam-bank and attempt models to changing institutional tenancy assumptions. Reuse tested rendering, storage, AI and scheduling components behind explicit adapters.

Use relational constraints for ownership links, unique answer per attempt item, unique selected subject per goal and revision identities. Published content and started forms are immutable; corrections publish new revisions. Archive published content rather than deleting history. Index ownership/history queries and bank selection by exam, subject, objective and publication status.

Personal study topics may reference published syllabus objectives, but learner outline edits must not modify the shared syllabus. Re-running setup must not duplicate personal subject workspaces.

## 7. Examination configuration and scoring

Keep examination rules in reviewed, versioned configuration rather than frontend constants or AI prompts.

JAMB baseline: the published JAMB manual describes 60 Use of English questions, 40 each for three other subjects, and 120 minutes overall. Before publishing a template, verify the applicable exam cycle and any changes. Do not assume a separate enforced time allocation per subject.

WAEC: configure per subject, examination series, paper and syllabus applicability. Capture compulsory questions, optional groups, duration, maximum marks and relevant materials. Format availability must match what the platform can actually render and mark.

Practice scoring must be transparent. Show raw accuracy and marks; label any scaled JAMB-style aggregate as a practice estimate under a documented policy. Do not present a simple percentage-to-grade conversion as an official WAEC grade boundary. Unmarked written answers remain pending/ungraded and do not silently become zero or disappear from denominators.

Readiness combines coverage and evidence from assessments, with a clear distinction between untimed practice and full timed mocks. New or untested topics show insufficient evidence. Avoid claiming a validated probability of passing.

## 8. Durable attempt engine

Proposed states: IN_PROGRESS → SUBMITTED or EXPIRED → GRADING → GRADED; explicit recoverable grading-failure state. Objective-only attempts may complete grading immediately.

- Start uses an idempotency key and transaction to prevent duplicate attempts.
- Freeze question revisions, option order, form and scoring policy before returning the attempt.
- Return server time/deadline; the client clock is display-only.
- Save checks owner, item membership, answer shape, attempt state and deadline.
- Use answer revisions to reject stale updates from another tab/device.
- Never include keys, rubrics or explanations in an active mock payload.
- Submission and expiry finalization are atomic and idempotent, including simultaneous requests.
- After expiry, reject further answers and finalize from confirmed saved answers.
- A durable expiry mechanism finalizes attempts even without an open browser. Implement and deploy a database-backed sweep/worker with single-finalization guarantees; Redis dependencies alone do not constitute a worker.
- Written grading runs after answer freezing through a recoverable task record with bounded retries. Save grading progress independently of the request lifetime.
- Content generation and external AI failures do not invalidate a completed objective attempt.
- Rate-limit expensive generation and attempt creation; observe latency and failure rates.

## 9. Content and administration

Content preparation runs alongside software work. It is a release dependency.

Workflow: source/register provenance → import or author → validate → academic review → preview → publish → correct through a new revision.

Admin capabilities:

- Manage exam subjects, syllabuses, sources, applicability and template versions.
- Import structured JSON/CSV with a documented schema; validate before committing.
- Review duplicates, missing options, invalid keys, broken assets, missing objectives and incomplete rubrics.
- Distinguish sourced past questions, human-authored exam-style questions and reviewed AI-assisted questions.
- Preview the learner's question and assembled paper.
- Publish teacher-reviewed shared mock-bank versions; retain audit events and correction reasons. Personal AI practice does not require manual publication for each question.
- Report content problems from results/lessons with a direct link to the relevant revision.

Content sufficiency gate: every advertised full mock must assemble a complete valid form, including required topic/section distributions and intact passage groups. Measure question reuse and expand the saved bank continuously. A missing form is a content-generation/review task, not a reason to remove that subject from the catalogue. If a complete form is unavailable, explain that state and offer topic practice rather than silently reducing question counts.

A collaborating teacher is available to upload subject materials. The interface must support this directly without requiring institutional KwikEval membership. Confirm exact syllabus versions and available materials during inventory; missing lecture notes must not block syllabus-based AI generation.

### AI generation and saved-bank workflow

1. Teacher/admin selects subject, examination, syllabus version and objectives, then uploads notes or requests syllabus-only generation.
2. Generate questions in bounded batches against coverage targets: objective, difficulty, question type and required stimulus. Do not generate an entire bank in one request.
3. Validate structured output, option keys, answer presence, marks, passage references and mathematical/media rendering. Detect exact and near duplicates before saving.
4. Save provenance: teacher material, private learner material or syllabus-only generation, plus model/generation version and review state. Record which objectives each item covers.
5. Personal learner-generated questions can be practised immediately after automated checks, labelled AI-generated. Automated validation checks structure and plausibility; it does not establish factual correctness.
6. Teacher reviews and corrects generated items for the shared mock bank, with batch filters and coverage dashboards. Questions built from private learner uploads remain private unless explicitly authorized for sharing; do not copy private source passages into a public bank automatically.
7. Reuse saved questions and generate only missing coverage or fresh variants. Queue bulk generation with cost limits, retry controls and progress reporting.
8. Student reports and repeated suspicious answer patterns feed a correction queue; retire defective revisions from new forms while preserving historical attempts.

Generating enough items is feasible with this model. The remaining work is ensuring the questions match the syllabus, have correct answers and explanations, and assemble into authentic paper structures. No lecture notes is a supported input state, not an error.

## 10. Implementation sequence and completion gates

| Phase | Deliverables | Completion gate |
| --- | --- | --- |
| 0. Specification/content inventory | Full subject catalogue, official-source register, teacher material workflow, supported format matrix and generation samples across subject groups | Applicable rules documented; coverage and format gaps explicit |
| 1. Profiles and schema | Additive migrations, goal/subject APIs, conditional onboarding and academic-stage progression | Existing tertiary accounts still work; new learner can save/resume goal setup |
| 2. Syllabus and content admin | Versioned syllabuses, question revisions, imports, preview/review/publish and audit | Reviewed sample bank imports; invalid and unpublished content cannot enter mocks |
| 3. Study and practice | Personal topic mapping, secondary lessons/chat, saved AI practice across subjects, mistakes/cards, planning adapters | Study → practice → feedback → revision works without cross-user progress leakage |
| 4. JAMB mock engine | Forms, durable attempts, timer, autosave/recovery, objective scoring and result review | Complete four-subject sitting passes functional, expiry and concurrency checks |
| 5. Pilot hardening | Content coverage, accessibility/mobile checks, error monitoring, deployment controls | Pilot checklist passes with sufficient reviewed content and tested rollback |
| 6. WAEC papers | Paper-specific rules, multipart written answers, rubrics, grading recovery and selected rich media | Each advertised subject/paper passes its own reviewed blueprint and grading checks |
| 7. Combined-goal revision | Cross-exam objective links, shared-time planning and distinct progress | Overlapping topics avoid duplicate sessions; exam evidence remains distinguishable |

No calendar commitment yet. Estimate implementation after Phase 0 establishes content availability and exact paper types. Engineering and academic review need separate estimates; content can be the critical path.

## 11. Verification plan

Meaningful automated checks:

- Profile validation for secondary, school-leaver and tertiary pathways; migration compatibility.
- Goal ownership and authorized access to published syllabus/bank data.
- No institutional content leakage or expanded institutional privileges.
- Import validation, publication permissions, asset handling and immutable revision history.
- Template assembly counts, topic distribution, passage grouping and optional-section rules.
- Attempt start retries, invalid question IDs, forged answers, unauthorized users and answer-key exposure.
- Deadline enforcement under changed client clock, refresh, late save and reconnect.
- Concurrent saves, submit-versus-expiry and repeated submissions produce one final result.
- Objective scoring fixtures and written partial/ungraded states.
- Grading task recovery, bounded retries and nonduplicated progress updates.
- Shared planning and mastery links without double-counting questions or objectives.

Browser journeys on desktop and mobile:

- New secondary account → goal → lesson → practice → full mock → results → revision.
- Refresh during a mock, short disconnection, recovered session, timeout with browser closed.
- Passage navigation, diagram rendering, keyboard controls and submission review.
- WAEC optional sections and written-response recovery.
- Existing tertiary login, courses, quizzes, plans, flashcards and GPA.

Use isolated databases and deterministic question fixtures. External AI is stubbed for core correctness tests; separately review representative real generated lessons and graded responses. Run affected workspace type checks/builds and required regression suites. Load-test saves and expiry at an agreed pilot concurrency before public expansion.

## 12. Deployment and operational readiness

- Additive database migration first; feature hidden until supported content is published.
- Feature flags for exam workspace, subject coverage, JAMB mocks and each WAEC paper type.
- Deploy verified expiry/grading processing with monitoring and restart recovery.
- Log attempt starts, save failures, expiry/finalization conflicts, grading failures, question reports and AI cost without logging raw student answers unnecessarily.
- Confirm account experience and data handling suit under-18 users before public release; avoid collecting extra sensitive data without a defined use.
- Pilot with a small invited cohort; collect completion, save reliability, content-error reports and learner comprehension feedback.
- Rollback disables new starts while preserving in-progress completion and historical review. Do not drop migrated tables or overwrite attempt history.

## 13. Principal risks and responses

| Risk | Response |
| --- | --- |
| Not enough accurate questions | Generate and save questions against syllabus coverage across all subject groups; prioritize teacher review of gaps and validate form sufficiency |
| Exam rules change | Version sources/specifications by applicability; verify before publication |
| Inaccurate AI feedback | Reviewed rubrics, visible estimates, report/correction workflow, representative calibration |
| Unreliable connectivity | Confirmed-save indicator, bounded local retry buffer, resume, server deadline |
| Cross-product data exposure | Dedicated exam scope, owner checks and institutional regression tests |
| Duplicate/mismarked results | Frozen form, atomic finalization, idempotent grading and mastery events |
| Too much scope | Sequence the study/generation engine, JAMB runner, WAEC paper capabilities and combined planning while retaining all subject groups in scope |
| Historic readiness becomes misleading | Separate practice evidence from timed-mock performance and show untested coverage |

## 14. Approval requested

Approve or revise these product choices before implementation:

1. One account with stage-appropriate onboarding and dashboards, including school leavers and later progression to tertiary study; no assumption of simultaneous enrolment.
2. Broad-subject study and practice foundation, followed by the JAMB mock runner, WAEC paper capabilities and combined-goal planning. This is an engineering sequence, not a subject restriction.
3. All applicable WAEC/JAMB subjects across science, arts/humanities and commercial paths, populated through teacher materials, student uploads and syllabus-based AI generation.
4. Saved AI-generated exam-style questions available for personal practice with clear provenance; teacher-reviewed shared banks for published mock forms, with generation and review used to grow coverage.
5. Dedicated exam-bank/attempt models that preserve KwikEval institutional boundaries.
6. Browser-first launch, with reconnect support; native apps, full offline mocks, parent/school dashboards and billing excluded initially.

Approval authorizes implementation of the agreed scope. It does not publish a deployment or imply content/reviewer availability. After approval, begin with Phase 0 and report concrete content gaps before estimating the full delivery schedule.

## 15. Reference material

Repository evidence:

- `docs/nightklass/01-product-vision.md`
- `docs/nightklass/02-onboarding-and-curriculum.md`
- `docs/nightklass/03-roadmap.md`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/modules/study/study.service.ts`
- `apps/api/src/modules/study/dto/generate-quiz.dto.ts`
- `apps/api/src/modules/assessments/assessments.service.ts`
- `apps/api/src/modules/attempts/attempts.service.ts`
- `apps/nightklass/src/app/(app)/onboarding/page.tsx`
- `apps/nightklass/ADMIN.md`

Official baseline sources (verify applicable year/series during Phase 0):

- [JAMB published examination manual](https://www.jamb.gov.ng/pdfs/2024/2024_EXAMINATION_MANUAL%28updated%29.pdf): baseline UTME structure and timing; not evidence that a later examination cycle has unchanged rules.
- [WAEC published 2025 school-candidate timetable](https://www.waecnigeria.org/sites/default/files/2025-03/FINAL%20INTERNATIONAL%20TIMETABLE%20-%20WASSCE%20%28SC%29%202025.pdf): illustrates subject/paper variation; not the launch cycle's final specification.
- [WAEC Nigeria FAQs](https://waecnigeria.org/faq?page=0): candidate guidance; verify current subject requirements for the selected cycle.
