# Nightklass launch-readiness audit

Prepared 22 October 2026 against `main` at `8986e8b` (`origin/main` at `4d85ecb`). This is an audit, not a remediation: no application code, data or configuration was changed. Every "confirmed" finding below cites code and, where marked **[reproduced]**, a check run during this audit.

## Verdicts

| Stage | Verdict | Basis |
| --- | --- | --- |
| Continued internal testing | **Ready** | Core flows work locally; the unit, integration and type checks pass at `067ae28`. |
| Invited pilot (small, text-only) | **Not ready** | Shared-IP rate limits block logins and drop mock autosaves (NK-01). There is no password recovery (NK-04), AI spend is uncapped (NK-03), there is no monitoring (NK-19), and the real deployment state is unknown (NK-05). Every pilot fix is bounded engineering work, not a redesign. |
| Broader public launch | **Not ready** | All pilot gates, plus: privacy/consent review for minors, passage support for English, randomized paper assembly, measured load capacity, marking calibration with real teacher-marked data, and content breadth. |

**Strongest foundations.** The data model separates standalone exam preparation from institutional assessment. Server-owned deadlines use optimistic versioning and Serializable transactions. Question snapshots are frozen and correction chains preserve history. The admin trust boundary is careful: grants are rechecked inside transactions, mutations are audited, and the admin session uses an httpOnly BFF. Written marking is honest: ungraded answers are never scored as zero, and practice labelling is consistent. The tests are real HTTP/PostgreSQL tests, not mock-only.

**Largest risks.** Operational edges, not exam logic: rate limiting, session recovery, cost control and observability. Academic authenticity is the other risk. With no passages and no diagrams, "English" and most science mocks are not representative, and WAEC papers repeat identically.

---

## B. Verified baseline

### Checks run during this audit

| Check | Command | Result |
| --- | --- | --- |
| API unit tests | `npx vitest run` (apps/api, working tree) | **90 passed / 14 files** |
| API types | `npx tsc --noEmit` | Pass |
| Nightklass types | `npx tsc --noEmit` | Pass |
| Nightklass production build | `npm run build` | Pass (mock route 112 kB first load) |
| Prisma | `prisma validate`, `prisma migrate status` | Valid; 20 migrations, local DB up to date |
| Exam integration @ `067ae28` | `npm run test:exam:integration` (isolated worktree) | **29/29 pass** |
| Exam integration @ working tree (= `8986e8b`) | same | **28/29. FAIL:** "WAEC PDF uploads retain the original timetable". The fixture PDF yields no text, so the AI stub is never reached. |
| Admin integration @ `067ae28` | `node --test test/nightklass-admin.integration.cjs` | 11/11 pass (created local `nightklass_admin_test`) |
| Browser e2e @ `067ae28` | `npx playwright test` | **12/14. Two mobile cases fail** with the UI alert `ThrottlerException: Too Many Requests` at login. |
| Lint | `npx eslint` | **Not runnable.** There is no ESLint install or config (already noted in README). |
| Dependency audit | `npm audit --omit=dev` | **2 critical, 9 high, 13 moderate, 1 low** (next 15.5.18, proxy-addr, multer, js-yaml, lodash, sharp, etc.) |
| Rate-limit probe | scratch script against `nightklass_exam_test` | **[reproduced]** Learner A made 95 requests, then a *different* learner B on the same IP got 429 on 5 of 10. `register-student` was never throttled (8 rapid requests, all 400 validation errors, zero 429s). |
| Snapshot size | SQL on test DB | A 180-question JAMB snapshot is ~100 KB of JSON text with short fixture questions. Autosave reads it on every save. |

Not verified: remote CI runs (`gh` is unavailable), production/Railway/Vercel state, real OpenAI output, physical devices or Safari, load capacity, backups.

### Report claims vs. repository

| Claim (05/06 docs) | Status |
| --- | --- |
| 88/90 unit, 29 integration, 14 browser passing | **Partially stale.** 90 unit pass. Integration is 29/29 only at `067ae28` and **28/29 at HEAD**. Browser is **12/14** in this run. The failures depend on timing because of the login throttle. |
| "Nothing has been pushed or deployed"; "production is not migrated" | **Contradicted.** `origin/main` already includes the exam extension through `4d85ecb` (5 of the 6 exam migrations). The README says pushes to `main` deploy to production, and `apps/api/Dockerfile` runs `prisma migrate deploy` on start. Production state must be checked (NK-05). |
| 05: "Uploaded PDFs … paper dates are not automatically inferred" | **Superseded** by `8986e8b` (AI extraction). 06 describes the new behavior, but 05 was not updated. |
| 06: "PDF date persistence and extraction-failure recovery" tested | The test exists but **fails at HEAD**. |
| Active mock payloads exclude keys/explanations/rubrics | **Confirmed** (`exam-mock.service.ts:278-281`). |
| Idempotent start/submit, stale-save rejection, durable expiry, grading retry/exhaustion | **Confirmed** by code reading and passing integration tests. |
| Admin grants rechecked, audited | **Confirmed** (`admin.guard.ts`, `mutate()` helpers). |

### Capability inventory

1. **Implemented and verified:** stage-aware onboarding, WAEC/JAMB goals with broad subjects, owner-scoped goals, draft/publish materials and questions, correction chains, syllabus versioning/provenance, objective-linked practice, JAMB timed mocks (assembly, autosave, recovery, expiry, idempotent submit, practice score), WAEC sectioned papers with optional selection and recoverable AI marking, generation jobs with leases, exam calendars and CSV timetables, admin BFF and audit log.
2. **Implemented, incompletely verified:** AI PDF timetable extraction (failing test). Mobile layout (emulated only). Concurrent mock behavior beyond 5-request smoke. Real AI generation and marking quality. Tertiary regression coverage: no tertiary flows in e2e.
3. **Partial:** content quality controls (stem-only duplicate fingerprint), coverage indicators (no evidence threshold), mock assembly (no blueprint, no randomization for WAEC).
4. **Missing:** password reset, email verification, account deletion/export, privacy notice/consent, per-user AI quotas, health endpoint, error tracking, alerting, backup/restore runbook, passage/stimulus questions, images/diagrams, learner content-error reporting for exam questions (lessons have `report`; bank questions do not), feature flag for exam features.
5. **Exists but inadequate:** IP-keyed rate limiting, learner token storage, storage fallback/public URL behavior, untrusted PDF parsing in-process, per-second full-payload autosave.
6. **External/manual:** syllabuses, specs, dates, reviewed question supply, teacher-marked calibration samples, R2/OpenAI/Railway/Vercel configuration, legal review for minors.
7. **Defer or remove:** unused `bull`, `@nestjs/bull`, `ioredis`, `resend` dependencies (no imports in `apps/api/src`). AI PDF timetable extraction is optional for a pilot: CSV plus manual entry is enough, and it adds a failing test and AI cost.

---

## C. Findings register

Severity reasoning: **Critical** means data loss, unauthorized access or wrong results at pilot scale. **High** blocks a safe pilot or seriously misleads learners. **Medium** is real but bounded. **Low** is minor.

### NK-01 — Rate limits are shared per IP; logins and mock autosaves fail for co-located learners
- **Category:** Confirmed defect **[reproduced]**. **Severity: High** (Critical if the deployment proxy collapses all clients to one IP).
- **Evidence:** `ThrottlerModule` keys by `req.ip` (`app.module.ts:32`). `main.ts` never sets `trust proxy`, so behind Railway's proxy, `req.ip` is the proxy address. `ExamMockController` uses `ThrottlerGuard` with 10 requests/s and 100/min per IP. Login allows 10 per 15 minutes per IP (`auth.controller.ts:33`). The mock runner calls `save()` every second while answers change (`mocks/page.tsx:220-235`).
- **Reproduction:** probe script (above). The e2e suite fails at login with `ThrottlerException: Too Many Requests`.
- **Impact:** A class on one school Wi-Fi or carrier NAT, or *every* user if the proxy IP is used, can be locked out of login after 10 sign-ins. During a mock, a 429 makes the runner show "Changes not yet saved". Submit then refuses ("Wait for all answers to save"), and at expiry the server finalizes with the last *saved* answers. Answers are silently lost, and the result is wrong.
- **Fix:** Set `app.set('trust proxy', <hops>)` for Railway. Key authenticated throttles by user id (custom `getTracker`). Limit login per account+IP, not per IP alone. Give mock save a per-attempt budget. Debounce autosave to 3–5 s with exponential backoff on 429. Show a human message instead of the raw exception name.
- **Verify:** a load test with 50 learners behind one IP taking a JAMB mock. Expect zero 429s on save and zero lost answers.

### NK-02 — Registration, join and refresh endpoints are not rate-limited
- **Category:** Confirmed security vulnerability **[reproduced]**. **Severity: Medium.**
- **Evidence:** `@Throttle({ default: … })` sits on `register`, `register-student`, `join` and `refresh` without `@UseGuards(ThrottlerGuard)`, and `ThrottlerGuard` is not an `APP_GUARD`. No throttler named `default` exists either; only `short` and `medium` are defined.
- **Impact:** Unlimited account creation (bcrypt cost-12 CPU load), spam accounts, and refresh-endpoint abuse.
- **Fix:** Register `ThrottlerGuard` globally and use the configured throttler names. Add a test that asserts 429 on the sixth registration.

### NK-03 — Learner AI usage is uncapped
- **Category:** Missing launch prerequisite / security (cost abuse). **Severity: High.**
- **Evidence:** The `study` and `learning` controllers (chat, quiz/flashcard/lesson generation, photo outline, course suggestions) have no throttle guard. No per-user or global quota exists. `AIUsageLog` records cost but nothing enforces it.
- **Impact:** One scripted account can generate unbounded OpenAI spend.
- **Fix:** A per-user daily token/cost quota computed from `AIUsageLog`, a global daily budget kill switch, and per-user throttles on AI routes.

### NK-04 — No account recovery, verification, deletion or privacy/consent flow
- **Category:** Missing launch prerequisite. **Severity: High.**
- **Evidence:** No reset or verify routes exist. `resend` is a dependency but is never imported. `users.controller.ts` has no self-delete or export. Registration collects only name, email and password, which is good minimization. There is no privacy notice, terms or age/guardian step. Learner answers and uploads are sent to OpenAI.
- **Impact:** A learner who forgets a password loses all history, and support must reset passwords by hand. Many WASSCE/UTME candidates are under 18. Nigerian data-protection obligations for children's data and cross-border transfer **need legal review**. This audit does not make a legal determination.
- **Fix:** Password reset by email (Resend is already a dependency) and email verification. Self-service delete and export. A privacy notice that discloses AI processing. An age question with a guardian-consent path, if counsel requires one.

### NK-05 — Deployment state is undocumented and possibly live
- **Category:** Missing launch prerequisite / process defect. **Severity: High.**
- **Evidence:** `origin/main` = `4d85ecb` contains the exam extension and migrations `…140000` through `…160000`. The README says the production workflow deploys pushes to `main`. The Dockerfile auto-runs `migrate deploy`. The docs say nothing was pushed or deployed.
- **Impact:** Production may already serve the exam routes and carry the new schema without the operator knowing. The next push (4 commits, including the failing test) would deploy immediately.
- **Fix:** Check the Railway deploy history and run `_prisma_migrations` on production. Correct docs 05 and 06. Protect `main`: require CI to pass before merge. Put the exam UI behind a server-side flag or allowlist for the invited cohort.

### NK-06 — HEAD has a failing integration test and contradictory documentation
- **Category:** Confirmed defect **[reproduced]**. **Severity: Medium.**
- **Evidence:** In `exam-calendar.service.ts`, extraction throws "PDF has no readable text" for the hand-built fixture before the stubbed AI runs, so `importedRows` is 0 where the test expects 1. Doc 05 still says PDF dates are not inferred.
- **Fix:** Use a fixture PDF with real text, or stub `pdfParse`. Update 05. Also, extraction cost is logged under action `EXTRACT_TOPICS`; give it its own action.

### NK-07 — Browser suite is order- and timing-dependent
- **Category:** Confirmed defect **[reproduced]**. **Severity: Medium.** CI will fail intermittently for the same root cause as NK-01.
- **Fix:** Resolve NK-01, or configure a test-only throttle limit. Reuse a stored auth state across tests.

### NK-08 — WAEC papers are identical on every attempt
- **Category:** Confirmed defect (product/academic). **Severity: Medium-High.**
- **Evidence:** `waec-paper.service.ts` start and availability select `orderBy: { id: 'asc' }, take: s.count` with no shuffle. Options are never shuffled either, in WAEC or JAMB.
- **Impact:** Retakes measure memory, not ability, and inflate coverage accuracy (NK-12). Questions beyond the oldest N are never used.
- **Fix:** Random sampling within section and topic constraints, preferring questions the learner has not seen. Shuffle MCQ options at freeze time and keep the mapping in the snapshot.

### NK-09 — Bounded pools ordered by time-sortable cuid silently starve newer questions
- **Category:** Technical debt with latent defect. **Severity: Medium** (becomes a defect once a subject exceeds the bound).
- **Evidence:** JAMB start uses `take: 5000, orderBy id asc` (`exam-mock.service.ts:186-195`). Practice uses `take: 1000, orderBy id asc` (`exam-content.service.ts:453-465`). Bank IDs are `cuid()`, which is roughly creation-ordered.
- **Impact:** Above the bound, new questions and **published corrections** are never served. JAMB start also loads up to 20,000 full rows into memory per start.
- **Fix:** Sample ids in SQL (e.g. `ORDER BY random() LIMIT n` on the filtered id set, or a stored random key with an index), then fetch only the chosen rows.

### NK-10 — No passages, shared stimuli or images
- **Category:** Verified limitation. **Severity: High** for product honesty.
- **Evidence:** The bank model has no stimulus or asset fields. The generator prompt says "Do not refer to absent passages or diagrams" (`exam-content.service.ts:228`).
- **Impact:** Use of English is compulsory for every JAMB candidate, and much of it is comprehension and cloze; those sections cannot be represented. Mathematics, physics, chemistry, biology, geography and accounting rely heavily on diagrams and tables. A "complete" mock can still miss whole classes of real items. Learners may over-trust readiness.
- **Fix:** Before the pilot, state on the start screen and the result screen which item types the mock excludes. Before public launch, add a `Stimulus` model (passage/table/image) referenced by questions, grouped during assembly. Images need asset storage and alt text.

### NK-11 — The duplicate fingerprint ignores options
- **Category:** Confirmed design flaw. **Severity: Low-Medium.**
- **Evidence:** `questionFingerprint(questionText)` plus `@@unique([exam, subjectKey, fingerprint])`.
- **Impact:** Legitimate MCQs that share a common stem ("Which of the following is a noble gas?") are rejected as duplicates, while trivially reworded copies pass. Near-duplicate detection does not exist.
- **Fix:** Fingerprint the stem plus the sorted normalized options. Add trigram or embedding similarity as a *review warning*, not a hard block.

### NK-12 — Coverage accuracy has no evidence threshold
- **Category:** Product defect (misleading indicator). **Severity: Medium.**
- **Evidence:** `exam-syllabus.service.ts:254-268` computes `practiceAccuracy` from any amount of evidence, including repeated attempts of the same item.
- **Impact:** One answer shows as 0% or 100%. Repeated identical WAEC papers (NK-08) inflate the number.
- **Fix:** Show `n` distinct questions. Use each item's latest result. Show "not enough evidence" below a minimum (e.g. 5 distinct items).

### NK-13 — Learner sessions are readable by JavaScript
- **Category:** Security weakness. **Severity: Medium.**
- **Evidence:** `auth-context.tsx:43-92` writes the access and refresh tokens to non-httpOnly cookies and `localStorage`. Refresh tokens are stored in plaintext in `refresh_tokens.token`, and rotation has no reuse detection. No CSP or security headers are set on the API or frontend. The admin side already uses httpOnly server cookies.
- **Mitigation present:** `react-markdown` without raw HTML. The only `dangerouslySetInnerHTML` is escaped JSON-LD.
- **Fix:** Move learners onto the admin BFF cookie pattern. Hash refresh tokens and revoke the token family on reuse. Add CSP and `helmet`.

### NK-14 — Storage can silently expose private uploads
- **Category:** Security weakness. **Severity: Medium.**
- **Evidence:** `storage.service.ts` falls back to the local filesystem whenever `R2_ACCESS_KEY_ID` or `R2_ENDPOINT` is missing, with only a warning. `main.ts` serves `uploads/` publicly with no auth. If `R2_PUBLIC_URL` is set, *every* object, including `personal/{userId}/documents/...`, gets a permanent public URL.
- **Fix:** Refuse to start in production without object storage. Use signed URLs for private prefixes. Use the public URL only for intentionally public assets.

### NK-15 — Untrusted PDFs are parsed in the API process with an unmaintained parser
- **Category:** Unverified risk. **Severity: Medium.**
- **Evidence:** `pdf-parse@1.1.1` bundles pdf.js 1.10.100 (2017, `isEvalSupported: true`). It runs on learner uploads up to 20 MB (`documents.service.ts:237`), with no timeout or worker isolation.
- **Impact:** A malformed PDF can hang or exhaust the API process, which also runs mock expiry and grading. Whether historic pdf.js code-execution CVEs are reachable through text extraction alone is **not verified**.
- **Fix:** Current `pdfjs-dist` with `isEvalSupported: false`, run in a worker thread with a time and memory cap.

### NK-16 — Known vulnerable dependencies
- **Category:** Confirmed (npm audit). **Severity: Medium-High.**
- **Evidence:** 2 critical (`next` 15.5.18, `proxy-addr`) and 9 high (`multer` DoS, `js-yaml`, `lodash`, `sharp`, …).
- **Fix:** Upgrade Next.js and the Nest platform packages, re-run audit, then triage what remains by reachability. Remove the unused `bull`, `@nestjs/bull`, `ioredis` and `resend`, unless Resend is adopted for NK-04.

### NK-17 — The written-marking prompt trusts student text and mislabels rubric fields
- **Category:** AI reliability. **Severity: Medium.**
- **Evidence:** `ai.service.ts:497-518` interpolates student answers between `--- id:` delimiters, so a learner can write "award full marks" or forge blocks. Scores are clamped per question. For THEORY items, the generator stores the *marking scheme* in `correctAnswer` and the *model answer* in `explanation` (`ai.service.ts:686`), but the grader labels `explanation` as "Marking points" (`exam-mock.service.ts:451`).
- **Fix:** Pass answers as JSON-encoded data, with an explicit instruction that student text is not instructions. Label the fields correctly. Add an adversarial grading test set.

### NK-18 — Generated content and grades carry no model/prompt version
- **Category:** Technical debt. **Severity: Medium.**
- **Evidence:** `ExamBankQuestion` and mock `result.writtenGrades` store no model or prompt version. Only `AIUsageLog` has the model.
- **Impact:** After a model change (`OPENAI_MODEL`), nobody can tell which items or grades came from which model, so recalibration is impossible.
- **Fix:** Store `{model, promptVersion}` on generated items and on each grade.

### NK-19 — No operational visibility or graceful shutdown
- **Category:** Missing launch prerequisite. **Severity: High.**
- **Evidence:** No health endpoint. No error tracking. No metrics or alerts. No `enableShutdownHooks()`, so `onModuleDestroy` does not run on SIGTERM and in-flight grading recovers only after the 5-minute lease expires. Workers run as `setInterval` in every API instance. No backup/restore runbook exists.
- **Fix:** A `/health` endpoint that checks the DB. Sentry or equivalent. Alerts on 5xx/429 rate, save-failure rate, grading `gradingFailed`, and daily AI cost. Shutdown hooks. A tested restore from a Railway backup.

### NK-20 — Subject identity is free text
- **Category:** Technical debt. **Severity: Medium.**
- **Evidence:** `subjectIdentity()` lowercases names and aliases only English and Mathematics. Learners can add custom subjects, and admins type subject names.
- **Impact:** "Christian Religious Studies" vs "CRK", or "Literature" vs "Literature in English", leave learners with empty content and no explanation.
- **Fix:** A canonical subject catalogue with aliases, used by both admin and learner pickers.

### NK-21 — Autosave cost grows with paper size
- **Category:** Unverified performance risk. **Severity: Medium.**
- **Evidence:** Every save runs a Serializable transaction that loads the full attempt snapshot (~100 KB of text for 180 short fixture questions) and the full answers map, about once per second per active learner. Coverage loads up to 100 full mock snapshots per request.
- **Fix:** Measure first (plan in F). Likely remedies: a 3–5 s debounce, saving only changed answers, a compact validation index (question id → option keys) on the attempt, and selecting only needed columns in coverage.

### NK-22 — Smaller issues
- **Low:** The `ExamGoal` unique key `(studentId, exam, year)` excludes `series`, so a learner cannot track a school sitting and a GCE sitting in the same year.
- **Low:** Learners aren't told when a question they practised was later corrected. Snapshots keep the old key silently.
- **Low:** Practice is not blocked during an active mock and shares the mock pool, so a learner can look up answers. Low stakes for self-practice, but worth knowing for mock realism.
- **Low:** WAEC submit requires selecting the exact optional count even if the learner attempted fewer. That is friction, not an error.
- **Low:** Exam bank questions have no learner "report an error" action, unlike lessons.
- **Low:** Lint is not configured.

---

## D. End-to-end journeys

- **New JAMB candidate.** Register (name/email/password only), pick secondary stage, choose English plus 3 subjects, then see materials, syllabus coverage and practice. Mocks unlock only when the content is complete, which is honest. *Gaps:* lockout risk (NK-01/04); no comprehension passages in English (NK-10); a single 0/100% coverage reading (NK-12); no diagnostic to start from.
- **WAEC candidate.** Choose a series and subjects; published papers show section shortfalls; take a paper; written answers are marked with retries. *Gaps:* the paper is the same every time (NK-08); text-only papers for practical- and diagram-heavy subjects need a visible disclaimer (NK-10); marking accuracy is unknown.
- **Preparing for both.** Subject workspaces are shared across goals, which is good: one Biology course serves both. Coverage is per-goal, which is correct. Same-name objectives share a topic. *Gap:* differently named equivalent objectives do not share progress.
- **School leaver or repeat candidate.** Stage is captured. Results history is limited to 50 mocks in the list. *Gap:* the same-year dual-series case (NK-22). Repeat candidates benefit most from unseen-question selection, which does not exist (NK-08/09).
- **Existing tertiary learner.** Records are preserved by design (nullable stage fields, reused courses). *Gap:* the e2e suite has **no tertiary regression flows**. Tertiary safety rests on unit tests and code reading only.
- **Teacher/admin.** The workflows are complete and audited: draft, review, publish, correct, generate in bounded jobs, map objectives, then papers, templates and calendars. *Gaps:* filling 180+ reviewed JAMB items per subject is a large one-at-a-time review load with no bulk import or bulk review. Duplicate false positives (NK-11). Subject naming must match learners exactly (NK-20). Bulk CSV import of reviewed questions would be the highest-leverage admin addition.

## E. Security and data integrity

- **Trust boundaries checked:**
  - Learner exam APIs require `role=STUDENT && organizationId=null` and owner-scoped lookups.
  - Admin APIs require an active standalone grant, rechecked inside transactions, with `Cache-Control: no-store`.
  - Institutional `GET /users/:id` is org-scoped, and standalone users see only themselves.
  - Mock membership validation rejects forged question, option or flag IDs.
  - No answer keys appear in active mock payloads, and `list` returns `result` only after finalization.
  - Practice returns sanitized copies.
- **Data integrity:** Serializable transactions with retry on P2034, version CAS on saves and finalization, lease-guarded grading writes, `activeKey` uniqueness for one active attempt, `requestKey` idempotency, and `Restrict` deletes that protect attempts from goal and template deletion. These are sound.
- **Open items:** NK-01, 02, 03, 04, 13, 14, 15, 16, 17. The study, learning, documents and questions modules (tertiary) were **not** exhaustively audited for IDOR. Spot checks were fine, but they need a pass with an automated authz matrix test.
- **Minors' data:** Collection is minimal, which is good. Retention, deletion, guardian consent and the AI-processor disclosure are absent (NK-04).

## F. Performance and reliability

- **Measured:** the snapshot size above, plus the earlier report's 5-request read smoke test. Nothing else; **there is no capacity evidence.**
- **Likely bottlenecks:**
  - Per-second autosave Serializable transactions reading large JSON (NK-21).
  - JAMB start loading up to 20k rows (NK-09).
  - Coverage loading 100 snapshots.
  - In-process PDF parsing (NK-15).
  - Throttling by shared IP (NK-01). This one is the *first* limit learners will hit.
- **Recovery:** Expiry and grading recover after restart through DB state and leases (integration-tested). Without shutdown hooks, recovery waits for lease expiry (≤5 min).
- **Pilot load test (k6 or Artillery against a production-like Railway environment, with a stubbed AI provider):**
  1. 100 learners log in from **one IP** and from 100 IPs.
  2. 100 concurrent JAMB mocks, answering one item every 10–30 s with realistic 300–600-character questions, for 15 minutes. Then submit all at once, and separately let 20 expire.
  3. 20 concurrent WAEC submissions with written answers, AI stub latency 5–20 s and 20% failure.
  4. Kill the API mid-run and restart.
- **Acceptance (proposal):** 0 lost confirmed answers; save p95 < 500 ms and p99 < 1.5 s; 0 unexpected 429s; every expired attempt finalized within 60 s; every WAEC attempt GRADED or `gradingFailed` within 10 min; DB CPU < 70%.

## G. Academic and AI quality

- **Content:** No real syllabus, specification, date or question data exists in the repo. Readiness depends entirely on teacher input. The software correctly refuses incomplete forms.
- **Authenticity:** These are text-only mocks without passages, diagrams, practicals or oral components (NK-10). Results are labelled practice estimates, which is correct, but the *coverage* of real paper structure is not disclosed on the mock itself.
- **Validation:** Structure is validated (option count, answer key, marks). Correctness is **not**; it relies on human review. The duplicate check is weak (NK-11). There is no item statistics loop yet: facility and discrimination are computable from mock answers already stored.
- **Marking reliability process** (the calibration script exists; the data does not):
  1. Pick 3 subjects with written papers (e.g. English, Biology, Economics) × 3 ability bands × 20 answers = 180 scripts.
  2. Two teachers mark each script independently to measure human agreement. AI marks blind.
  3. Run `exam-marking-calibration.cjs`.
  4. Accept per subject when mean absolute normalized error ≤ 10%, |bias| ≤ 5%, and AI–teacher agreement is no worse than teacher–teacher agreement.
  5. Below threshold: label written marks "indicative" or hold the subject back.
  6. Repeat after any model or prompt change (requires NK-18).
- **Question quality targets for the pilot:** 100% human-reviewed published items; reported-error rate < 2% of items served; duplicate rate measured by similarity review; time-to-correction < 72 h.

## H. Testing gap matrix

| Risk | Existing test | Missing |
| --- | --- | --- |
| Lost answers under load or shared IP | None | Load test (F), multi-user same-IP integration test |
| Rate limits not applied | None | Assert 429 on register, join and refresh |
| Answer-key leakage | Integration (active payload) | Authz matrix across all learner routes, incl. `/questions` and study |
| Expiry/submit race | Integration (concurrent submit, late save) | Kill-and-restart during grading (manual or chaos) |
| WAEC marking accuracy | Deterministic stubs | Calibration dataset (G), adversarial answers |
| Tertiary regressions | Unit only | e2e: tertiary login → course → quiz → plan |
| Paper repetition / pool starvation | None | Unit test: two starts give different forms; pool > bound serves new items |
| Mobile and real devices | Chromium emulation | Physical Android (low-end, the primary audience), Safari/iOS |
| Accessibility | One keyboard test | axe scan in e2e; screen-reader pass on the mock runner |
| Migrations on real data | Fresh-DB deploy | Deploy against a production snapshot copy, then roll forward |
| PDF timetable extraction | Failing integration test | Real-text fixture; malformed-PDF timeout test |

## I. Product and architecture recommendations

**Keep.** The one-account learning engine. Standalone exam models separate from institutional assessments. DB-state workers with leases (they are sufficient at pilot scale; Redis/Bull is not needed). Frozen snapshots. Draft/publish with audit. Honest "practice estimate" labelling.

**Change:**
- Throttling keyed by user, not IP (NK-01).
- Learner auth on httpOnly cookies (NK-13).
- Random, blueprint-aware assembly with seen-item avoidance (NK-08/09).
- A canonical subject catalogue (NK-20).
- Evidence thresholds on indicators (NK-12).
- A feature flag or allowlist for the exam area so the pilot cohort can be gated independently of deploys (NK-05).

**Simplify or defer.**
- AI PDF timetable extraction is not pilot-critical; CSV plus manual review covers it.
- Remove unused queue and email dependencies, or use Resend for NK-04.
- Do not add more subjects to the advertised mock set until each has verified content.

**Worth building (in value order):**
1. Bulk import plus bulk review of questions. This is the main bottleneck to having *any* complete mock.
2. Stimulus/passage groups. English is compulsory for everyone.
3. Post-mock review that feeds weak objectives straight into the plan. Today only objective practice feeds mastery.
4. A short diagnostic per subject at onboarding to seed the plan.
5. Spaced re-practice of missed items, reusing the flashcard scheduler.
6. Item statistics to retire bad items automatically for review.

Not recommended now: gamification, social features, parent dashboards, native apps.

## J. Execution roadmap

1. **Critical fixes and safety:**
   - NK-01 (trust proxy, user-keyed throttles, autosave debounce/backoff).
   - NK-05 (establish the production state, protect `main`, flag the exam area).
   - NK-02 (global throttler guard).
   - NK-03 (AI quotas and kill switch).

   *Acceptance:* the same-IP multi-user test passes, 429 tests pass, CI is required on `main`, and the production migration state is documented.
2. **Before the invited pilot:**
   - NK-04 (password reset, privacy notice, deletion; legal review on consent).
   - NK-19 (health, error tracking, alerts, shutdown hooks, a tested restore).
   - NK-06/07 (a green suite).
   - NK-14 (storage fail-closed).
   - NK-16 (upgrade Next.js and Nest).
   - NK-10 disclosure text.
   - NK-08 (randomize WAEC assembly).
   - NK-12 (evidence threshold).
   - Content gates for the *specific* subjects advertised.
   - The load test in F.
3. **Before public expansion:**
   - NK-13, NK-15, NK-17, NK-18, NK-09, NK-20, NK-21.
   - Stimulus support.
   - Calibration meeting thresholds.
   - Physical-device testing.
   - An accessibility review.
   - Tertiary e2e coverage.
   - An authz matrix test.
4. **High-value next:** bulk import/review, post-mock → plan loop, diagnostic, spaced re-practice, item statistics, learner error reports on bank items.
5. **Optional:** dual-series goals, option shuffling refinements, correction notifications, removing AI PDF extraction if unused.

## K. Launch decision checklist

**Engineering**
- [ ] The full suite (unit, integration, e2e) is green on `main` in **remote** CI, with a linked run.
- [ ] A same-IP multi-learner mock test shows 0 lost answers and 0 unexpected 429s.
- [ ] Registration, join and refresh return 429 when abused.
- [ ] `npm audit --omit=dev` shows no critical issues, and any remaining high issues have a written reachability rationale.

**Security and privacy**
- [ ] Password reset and email verification work end to end in production.
- [ ] A privacy notice discloses AI processing. Deletion works. Legal sign-off on minors' consent is recorded.
- [ ] Production refuses to start without object storage, and private uploads are not publicly reachable.
- [ ] Per-user and global AI spend caps are enforced and alerting.

**Operations**
- [ ] The production migration state is recorded, and a restore from backup has been rehearsed.
- [ ] Health checks, error tracking and alerts exist for save failures, grading failures and AI cost.
- [ ] The exam area is gated to the invited cohort, and rollback means disabling starts and new templates.
- [ ] The load test in F meets its thresholds on the production-like environment.

**Content (per advertised subject or paper)**
- [ ] A syllabus is published with provenance verified (OFFICIAL only with the source checked).
- [ ] The specification has been checked against the current cycle's source, and verified dates are published.
- [ ] Reviewed items cover at least 2 full distinct forms, so a retake is not identical.
- [ ] The mock screen discloses which item types it excludes (passages, diagrams, practicals).
- [ ] For written papers, calibration meets the G thresholds, or marks are labelled "indicative".
- [ ] A support and correction channel exists with a < 72 h correction target.

---

## Answers to the seven questions

1. **What genuinely works today?** The exam engine's core correctness works. That covers server-owned timing, idempotent start/submit, stale-save rejection, durable expiry, recoverable written marking, key hiding, frozen snapshots and correction history. The admin content pipeline works with audited, rechecked permissions. So do onboarding, goals and the shared learning engine. All of this is backed by 29 passing real-DB integration tests at `067ae28`.
2. **What is broken, unsafe, misleading, incomplete or overcomplicated?**
   - **Broken:** shared-IP throttling (reproduced, and it breaks the repo's own browser suite); the failing HEAD test; inaccurate deployment documentation.
   - **Unsafe:** unthrottled registration, uncapped AI cost, JS-readable learner tokens, storage fallback and public URLs, outdated dependencies.
   - **Misleading:** identical WAEC retakes, low-evidence accuracy percentages, and mocks that omit passages and diagrams without saying so.
   - **Incomplete:** account recovery, privacy/consent, monitoring.
   - **Overcomplicated:** only marginally. AI PDF extraction and the unused queue dependencies.
3. **Most important fixes:** NK-01, NK-05, NK-03, NK-04, NK-19, then NK-08/NK-10/NK-12 for academic honesty.
4. **Before inviting real learners:** sections J1 and J2, and the content gates for each advertised subject.
5. **Before a wider launch:** J3, with stimulus support, calibration evidence, measured capacity, device and accessibility coverage, and legal sign-off.
6. **What I would change:**
   - Rate-limit by identity, not network location. Learners in Nigeria commonly share NAT and school networks.
   - Gate features with a flag instead of relying on "not pushed". Pushes already deploy.
   - Treat question supply (bulk import/review) and passages as core product, not later enhancements. Without them, the mocks cannot be both complete and representative.
   - Keep the rest of the architecture.
7. **Evidence that would convince me:**
   - A green remote CI run on protected `main`.
   - A load-test report meeting the F thresholds from a shared IP.
   - A documented production migration and restore rehearsal.
   - Working password reset and privacy flow, with legal sign-off.
   - For each advertised subject: two distinct reviewed forms and a calibration report within thresholds.
   - A two-week invited pilot with < 0.1% save failures, no lost attempts, and content errors corrected within 72 h.
