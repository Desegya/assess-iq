# Nightklass launch-readiness remediation report

Prepared 22 October 2026 on branch `fix/nightklass-launch-readiness`, based on `8986e8b`. Nothing on this branch has been pushed, merged or deployed.

## A. Summary

This work fixes the defects in the [audit](07-launch-readiness-audit.md) that could lock learners out, lose mock answers or misreport progress, and adds the controls a pilot needs.

**Reliability**
- Rate limits now apply per account, so learners on one school or carrier network no longer share a budget.
- Mock autosave survives throttling, outages, conflicts and reloads.
- A class can onboard together without spurious conflicts.

**Cost**
- AI spend is capped durably, per learner and globally, with a kill switch.

**Security and privacy**
- Password reset, email verification, data export and account deletion.
- Hashed, rotating refresh tokens with reuse detection.
- Private-only storage that fails closed.
- Bounded PDF parsing.
- CSP and security headers.
- No critical dependency advisories.

**Academic honesty**
- Mock forms are distinct across retakes and options are shuffled.
- Progress figures need real evidence before a percentage is shown.
- Mocks disclose what they leave out.
- Written marking treats learner text as data and records which model and prompt produced each mark.
- Calibration is a per-subject gate.

**Operations**
- Health and readiness endpoints, graceful worker shutdown, an operations page, a server-side pilot cohort and emergency brakes.

**Readiness:**

| Stage | Verdict |
| --- | --- |
| Internal testing | **Ready.** All local suites pass; see section D. |
| Invited pilot | **Ready with conditions.** The software gates are met locally. The pilot still needs owner, legal and content actions: production state, configuration, remote CI, legal review, support contact, per-subject content and a staging load run. See section E. |
| Broader public launch | **Not ready.** Section G. |

## B. Findings disposition

| ID | Finding | Disposition | Evidence |
| --- | --- | --- | --- |
| NK-01 | Shared-IP rate limits; lost autosaves | **Fixed and verified locally.** Production proxy hop count still needs confirming. | Security suite: 300 requests from 5 learners on one address all succeed. Load test (section D). Browser case: 429/503/offline autosave. 8 autosave unit tests. |
| NK-02 | Credential endpoints not throttled | **Fixed and verified.** | Security suite: `/auth/register` returns 429 after 10. Per-account lockout tests. Unit tests for tracking and proxy parsing. |
| NK-03 | Uncapped AI cost | **Fixed and verified with stubs.** Live-provider costs not exercised. | 8 concurrent calls against a 2-call budget admit exactly 2. Accounting survives a fresh service instance. Kill switch blocks all provider calls. Owner-only and audited. |
| NK-04 | No recovery, verification, deletion or privacy flow | **Fixed (software); legal review outstanding.** Real email delivery not verified (no Resend credentials). | Reset lifecycle, verification and deletion tests (API and browser). Privacy notice is live in the app. Section E lists the legal questions. |
| NK-05 | Deployment state undocumented | **Resolved as far as access allows.** Vercel production serves `4d85ecb`; the Railway API is older (owner reports a Railway incident). Server-side cohort gate implemented. Branch protection not verifiable. | `vercel inspect`; API route probes; runbook section 1. |
| NK-06 | Failing HEAD PDF test, contradictory docs | **Already resolved before this work** (`8986e8b` fixed the parser input; the audit ran on pre-commit work in progress). Docs 05 and 06 now carry corrections. | 29/29 at `8986e8b` once committed. |
| NK-07 | Order-dependent browser suite | **Fixed and verified.** 22/22 cases pass. The suite failed only because of NK-01. | Playwright run, section D. |
| NK-08 | Identical WAEC papers | **Fixed and verified.** Unseen-first sampling plus option shuffling. | A 4-question pool gives 2 fully distinct 2-question forms. Shuffled keys score correctly. |
| NK-09 | Pool starvation from `ORDER BY id LIMIT` | **Fixed and measured.** | Database-side sampling over all published questions: 56 ms at 50,000 questions. |
| NK-10 | No passages or diagrams | **Disclosure fixed.** Stimulus support **deferred**; see section E. | Format notice frozen into each attempt and shown before, during and after a mock (browser test). |
| NK-11 | Duplicate fingerprint ignored options | **Fixed and verified.** Fingerprint v2, a legacy exact-copy check, and a similarity review signal. | Unit tests. Generation test records v2 and generator metadata. |
| NK-12 | Coverage percentage from one answer | **Fixed and verified.** Distinct items, latest result, evidence levels, corrections excluded. | Integration and browser tests ("Too early to tell · 1 question"). |
| NK-13 | JS-readable learner tokens | **Partly fixed.** Tokens removed from cookies; CSP added; refresh tokens hashed with family reuse detection; session versioning. **httpOnly BFF deferred**; see section E. | Refresh, logout and reset tests; header check on the production build. |
| NK-14 | Storage exposure and fallback | **Fixed and verified.** Fails closed in production; `R2_PUBLIC_URL` refused; short-lived signed links only. | Tampered, expired, traversal and guessed links return 404. Production refuses local storage. |
| NK-15 | Untrusted PDF parsing in-process | **Contained.** Worker thread with timeout, heap cap and page limit. **Parser replacement deferred.** | 4 unit tests with real PDF bytes; integration uploads. |
| NK-16 | Vulnerable dependencies | **Criticals fixed.** 5 highs remain with reachability noted. | `npm audit --omit=dev`: 2 critical / 9 high → 0 / 5. |
| NK-17 | Grading prompt trusted learner text | **Fixed and verified (stubbed).** | Adversarial-output unit tests: forged IDs, duplicates, out-of-range scores, oversized feedback. Structured JSON input. Correct scheme and notes labels. |
| NK-18 | No model or prompt provenance; no calibration | **Fixed (software); calibration data outstanding.** | Grades record model, prompt version, implementation and `INDICATIVE`. Bank items record generator model and prompt. Calibration gate tested on synthetic data only. |
| NK-19 | No visibility; no graceful shutdown | **Fixed locally.** Error tracker not added (no credentials). Production backup not verified. | Health tests; shutdown drains and releases leases; restart under load (section D); local restore rehearsal. |
| NK-20 | Free-text subject identity | **Fixed (alias table plus migration).** A full catalogue with stable IDs is deferred. | Unit tests; migration verified on a scratch database with conflicts. |
| NK-21 | Autosave cost grows with paper size | **Measured.** Save p95 under load in section D. Saves now send changed answers only and no longer use Serializable. | Load test. |
| NK-22 | Smaller issues | Practice paused during a running mock: **fixed**. Learner reports: **fixed**. Correction notices to learners: **deferred**. Same-year dual-series goals: **deferred**. Optional-selection friction: **kept** (it reflects paper rules). Lint: **deferred**. | Integration tests. |

### New findings during remediation

| ID | Finding | Disposition |
| --- | --- | --- |
| NK-23 | **Live production mismatch.** `nightklass.com` serves the exam-extension frontend while the Railway API is older, so new-user onboarding very likely fails. | Owner action (runbook section 1). Not changed by this branch. |
| NK-24 | Serializable isolation made unrelated learners' onboarding and autosaves fail each other under concurrency. | **Fixed and verified:** retry helper; Read Committed for per-learner writes. 100/100 under load. |
| NK-25 | Pure-JS bcrypt blocked the event loop during sign-in storms. | **Fixed and verified:** PBKDF2 on the thread pool with transparent upgrade. Sign-in p95 went from 12.8 s to 129 ms. |
| NK-26 | Graceful shutdown hung on keep-alive sockets. | **Fixed and verified:** `forceCloseConnections`. Restart under load went from ~9 min to 4.5 s. |
| NK-27 | Written marking was strictly sequential. | **Fixed:** concurrency 4. 20 papers went from 179 s to 105 s. |
| NK-28 | Refresh failing on a dropped connection signed learners out mid-mock. | **Fixed:** only an explicit 401 ends the session. |
| NK-29 | A tap before hydration natively submits auth forms, reloading the page and losing input. Nothing leaks, because the inputs have no `name` attributes. | **Fixed** for the new recovery forms (disabled until hydrated). Login and registration still allow it; low severity follow-up. |

## C. Implementation

**API**

| Area | What changed |
| --- | --- |
| Bootstrap | `configure-app.ts`: trust proxy, security headers, validation, health outside `/api`. `environment.ts`: production fail-closed checks. `main.ts`: shutdown hooks; no static uploads in production. |
| Rate limits | `auth/throttle.ts`: global `AppThrottlerGuard`, account-keyed when signed in; named credential throttles. `auth/login-attempt-limiter.ts`. Per-account AI route throttles. |
| Sessions and recovery | Hashed refresh tokens with families and a 20 s rotation grace; `sessionVersion` revocation; `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email[/resend]`; Resend email service. |
| Data rights | `GET /users/me/export`; `DELETE /users/me` (standalone learners only; anonymised tombstone; files removed). |
| AI | `ai/ai-quota.service.ts`: advisory-locked reservations, per-user, admin and global budgets, kill switch. Bounded SDK timeout and retries. Structured, injection-resistant grading. Generation and grading provenance. |
| Operations | `operations/`: runtime settings, exam cohort guard, new-attempt brake, health, admin operations API, question reports. |
| Exams | `exam-sampling.ts`: unseen-first database sampling, exposures, option shuffling. Fingerprint v2 and similarity. Evidence-based coverage. Format disclosures. Subject aliases. Practice pause during mocks. Concurrency: Serializable retry helper; Read Committed for mock save and goal save. |
| Files | Signed local links; `common/pdf-text.ts` worker isolation. |

**Database migrations**

- `20261023100000_launch_readiness_security`
- `20261023110000_privacy_acknowledgement`
- `20261023120000_canonical_subject_keys`

All three are additive or data-only and safe to re-run; see runbook section 4.

**Nightklass**

- Autosave controller.
- Session marker instead of token cookies; single-flight refresh; `ApiError`.
- CSP and security headers.
- Recovery pages, privacy notice and account page.
- Coverage evidence display and pilot-access message.
- Format notices and question reports in mocks.
- Admin operations page.

**CI:** audit gate, schema checks, type checks, unit, integration (exam, security and admin), build and browser.

## D. Verification evidence (local, 22 October 2026)

| Check | Command | Result |
| --- | --- | --- |
| API unit tests | `npx vitest run` (apps/api) | **124/124** (17 files) |
| Nightklass unit tests | `npm run test:unit` | 8/8 |
| Exam + security integration | `node --test --test-concurrency=1 test/nightklass-exam.integration.cjs test/nightklass-security.integration.cjs` | **48/48** |
| Admin integration | `node --test test/nightklass-admin.integration.cjs` | **11/11** |
| Browser (desktop + mobile emulation) | `npx playwright test` | **22/22** |
| Type checks / builds | `tsc --noEmit` (both); `nest build`; `next build` | pass |
| Migrations | `prisma validate`; `migrate deploy` on fresh and previously migrated test databases; alias migration on a scratch database with conflicts | pass |
| Production headers | `next start` and `curl -I` | CSP, nosniff, frame-deny, referrer policy, HSTS present |
| Dependency audit | `npm audit --omit=dev` | 0 critical, 5 high (reachability in the `chore(deps)` commit) |
| Sampling query at scale | `EXPLAIN ANALYZE` on 50,000 questions | 56 ms, top-N heapsort |

**Restore rehearsal (local):**
1. `pg_dump -Fc` of the test database (4.7 MB, 890 users, 564 attempts, 8,948 questions).
2. `pg_restore` into a new empty database (2 s). Row counts were identical.
3. `prisma migrate status` flagged the one migration not yet applied.
4. `migrate deploy` brought it up to date, and the copy was dropped.

This rehearses the procedure only; Railway's backups were not touched.

### D.2 Load and recovery (local)

Run with `node test/load/mock-load.cjs` on one laptop with Docker PostgreSQL, the API in its own process and stubbed AI. Raw results: [load-results-2026-10-22-local.json](load-results-2026-10-22-local.json).

| Measure | First run | After fixes | Target |
| --- | --- | --- | --- |
| Confirmed answers lost (of 6,000), API killed and restarted mid-exam | 0 | **0** | 0 |
| Concurrent onboarding (100 learners) | 56/100 succeeded | **100/100** | 100% |
| Mock starts (100 simultaneous, 180 questions each) | 56 started* | **100/100**, p95 1.5 s | all |
| Save latency p50 / p95 / p99 | 16 / 42 / 1,123 ms | **14 / 26 / 37 ms** | p95 < 500 ms, p99 < 1.5 s |
| Unexpected 429s on saves | 0 | **0** | 0 |
| Sign-in p50 / p95 (100 learners over 20 s from one address) | 5.9 s / 12.8 s | **90 / 129 ms** | p95 < 2 s |
| Sign-in burst retries (10/s per address) | 12 | 18, all succeeding after 1 s | documented |
| Kill → serving again | ~9 min (shutdown hung) | **4.5 s** | < 60 s |
| Expired attempts finalized by the worker alone (50) | 29 s | **24 s** | < 60 s |
| WAEC written papers (20; AI latency 5–20 s, 20% failures) | all marked in 179 s | **all marked in 105 s**, none failed | ≤ 10 min |
| Peak DB connections / server memory | 19 / 382 MB | 19 / 386 MB | within plan limits |

\* Failed starts followed from the failed onboarding.

What the first run found, and what was fixed:
- Serializable conflicts between unrelated learners at onboarding.
- Pure-JS bcrypt blocking the event loop during sign-in storms.
- HTTP shutdown waiting on keep-alive sockets.
- Strictly sequential written marking.

**Limits of this evidence:**
- A laptop is not Railway.
- AI is stubbed.
- One API instance.
- The client save cadence is compressed (one answer every 0.5–2 s, harsher than a real learner).

Run the same script against a production-like staging environment before inviting learners (section E, item 6).

**Not verified:**
- Remote CI.
- Production configuration, migrations and backups.
- Real OpenAI output, cost and latency.
- Real email delivery.
- Physical devices, Safari or iOS.
- Screen readers.
- Load on production-like infrastructure (the local run uses one laptop and a Docker PostgreSQL).

## E. Remaining blockers and deferred work

**Invited pilot — owner, legal or content actions**

1. **Production state.**
   - Confirm the Railway deployment and `_prisma_migrations` (runbook section 1).
   - Resolve the frontend/API mismatch on `nightklass.com` (onboarding very likely failing for new users).
   - Protect `main` and require CI.
2. **Configuration.**
   - Remove `R2_PUBLIC_URL` if it is set.
   - Set `TRUST_PROXY=1`, `PASSWORD_RESET_URL`, Resend credentials and `NEXT_PUBLIC_SUPPORT_EMAIL`.
   - Confirm `APP_URL` origins use https.
3. **Remote CI green** on the PR for this branch.
4. **Legal review** (Nigerian data protection and children's data). Questions for counsel:
   - Is the sign-up acknowledgement sufficient for learners under 18, or is verifiable parental consent required? If so, through what mechanism and from what age?
   - Is the lawful basis for processing learners' answers with a US-based AI provider adequate, and what cross-border transfer safeguards or disclosures are required?
   - What retention periods apply to learner records, AI usage metadata, audit logs and backups after deletion?
   - Does Nightklass need to register with, or file audits for, the Nigeria Data Protection Commission at the expected data volume?
   - Is a data processing agreement needed with each processor (Railway, Vercel, Cloudflare, OpenAI, Resend)?
5. **Content gates per advertised subject** (runbook section 9): verified specifications and dates, at least 2 distinct reviewed forms, and a correction owner.
6. **Staging load run.** Run `test/load/mock-load.cjs` against a production-like Railway staging environment with a disposable `*_test` database, never production data. Set `LOAD_ALLOW_REMOTE_DB=yes` for the non-local host. Check the results against section D.2.
7. **Backups.** Confirm Railway backup schedule and retention, and rehearse a restore into a new service.

**Deferred, with reasons**

- **Passage, table and image stimuli.**
  - It needs a stimulus model, asset storage, alt text, grouped assembly and a reviewed admin authoring flow. That is a product capability, not a column.
  - Without verified passages or diagrams to load, it would not change what learners can take.
  - The disclosures make the current limits explicit. **Required before broad launch for English and diagram-heavy subjects.**
- **Learner httpOnly BFF sessions.**
  - Two prerequisites first: an API on a `nightklass.com` subdomain (cross-site cookies are blocked), and a direct-to-storage upload path. Vercel functions cap bodies at 4.5 MB, but learner uploads reach 20 MB.
  - Mitigations in place: CSP, no token cookies, hashed rotating refresh tokens with reuse detection, and session revocation.
- **PDF parser replacement** (pdf-parse 1.1.1). It needs an ESM-compatible `pdfjs-dist` integration. Parsing is already bounded in a worker.
- **Nest 12 upgrade.** Clears the remaining multer, js-yaml and lodash highs.
- **Error tracker** (e.g. Sentry). Needs credentials and an owner decision.
- **Bulk question import and bulk review.** The largest content-operations win; not started, to protect release-critical work. Recommended next.
- **Same-year dual-series WAEC goals; correction notices to learners; item statistics UI; diagnostic onboarding; spaced re-practice of missed items.** Product enhancements.
- **ESLint configuration.** No working setup exists; adding one would produce large unrelated churn.

**Broader public launch**

- All pilot items.
- Stimulus support.
- Calibration verdicts of `CALIBRATED` for advertised written subjects (needs real teacher-marked scripts).
- Physical Android, iOS and Safari testing.
- Accessibility review with a screen reader.
- An authorization-matrix test across all learner routes.
- Production-like capacity testing at the expected concurrency.
- An error tracker with alerting.
- An incident-response owner.
- Legal sign-off.

## F. Calibration input (format `nightklass-marking-calibration/1`)

A JSON array, one object per marked script. It must contain no names, emails, learner IDs or answer text; the script refuses such fields.

```json
[
  { "questionId": "bio-2027-p2-q3", "subject": "Biology", "abilityBand": "middle",
    "maxMarks": 10, "teacherScore": 6, "secondTeacherScore": 6.5, "aiScore": 5.5 }
]
```

Run `node apps/api/scripts/exam-marking-calibration.cjs paired.json` (after `npm run build` in apps/api).

A subject is `CALIBRATED` only when all of these hold:
- at least 60 double-marked scripts
- at least 3 ability bands
- mean error ≤ 10% of maximum marks
- |bias| ≤ 5%
- AI–teacher error within 2 points of teacher–teacher disagreement

## G. Readiness checklist

| Gate | Internal | Pilot | Public |
| --- | --- | --- | --- |
| Local test suites green | ✅ | ✅ | ✅ |
| Remote CI green on the release candidate | — | ☐ owner | ☐ |
| Shared-IP traffic and autosave resilience | ✅ local | ✅ local, ☐ staging | ☐ production-like |
| AI budgets and kill switch | ✅ | ✅ (stubbed), ☐ live check | ☐ |
| Recovery, export and deletion | ✅ | ✅ software, ☐ email delivery | ☐ |
| Privacy notice | ✅ | ☐ support contact, ☐ legal review | ☐ |
| Production config and migration state known | — | ☐ owner | ☐ |
| Monitoring and restore | ✅ local | ☐ backup confirmed and restored | ☐ error tracker |
| Content per advertised subject | — | ☐ teacher | ☐ |
| Marking calibration | — | indicative only | ☐ calibrated |
| Passages and diagrams | — | disclosed | ☐ implemented |
| Devices and accessibility | Chromium + emulation | ☐ one real Android | ☐ full |
