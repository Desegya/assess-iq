# Nightklass — Build Roadmap

Maps [01-product-vision.md](01-product-vision.md) and [02-onboarding-and-curriculum.md](02-onboarding-and-curriculum.md) onto the current codebase. Ordered so every phase ships something a student can see.

**Already in place:** courses with code/level/semester, topics, document upload (PDF/DOCX/TXT) + topic extraction, study plan from availability + exam date, plan redistribution for missed sessions, MCQ/true-false self-quizzes, SM-2 flashcards, weak topics, streaks/progress, per-course AI chat, GPA calculator, AI topic suggestions from the course title, AI study notes per topic.

## Phase 1 — First impression (frontend-heavy) ✅ done 2026-10-03
- Landing page rewrite: descriptor, hero copy, primary/secondary CTA, "no syllabus required", 8-stage journey, dashboard preview. Drop "never for a grade".
- Sidebar regrouped: Main / Learning / Progress / Account.
- New Course: three-path entry (from my programme · manually · upload outline). Manual form = one code/title field + level + semester + optional credit units; Subject and Description removed (subject inferred).
- Course page: after creating a course with no topics, offer "Generate outline with AI" immediately.

## Phase 2 — Academic profile & course suggestions ✅ done 2026-10-03
- Profile onboarding after sign-up: country, institution type, programme, level, semester (+ optional institution, faculty, session, graduation year). Replaces `courseOfStudy` / `programYears`.
- New-user dashboard: "Let's build your semester" instead of zero stats.
- Course suggestions: AI tier (level 3) first, labelled as suggestions; tick to add, search, add electives/carryovers.
- Carryover detection when course level ≠ student level.
- Not yet: free-text search over a course catalogue (needs the Phase 6 curriculum database). Students add unlisted courses manually.

## Phase 3 — Two-layer outline & syllabus editing ✅ done 2026-10-03
- Official/original outline stored separately from the Nightklass expanded learning outline; "Expand with AI" creates the expanded layer.
- Modules → topics → subtopics; edit, reorder, delete, add.
- Outline versioning that keeps progress intact (sessions/mastery stay linked to topics that survive an edit).
- Outline input: paste text, PPTX, image/photo (via a vision-capable model rather than separate OCR).
- Not yet: rolling the outline back to an earlier revision (history is recorded and viewable; archived topics can be restored individually).

## Phase 4 — Learning content engine ✅ done 2026-10-03
- Structured per-topic content: objectives, explanation, key terms, worked examples, applications, summary (builds on the existing notes feature).
- Source tracking: material-grounded / AI-generated / combined, stored with version; regenerate, edit, report inaccurate.
- Retrieval: chunk uploads and pull relevant sections per topic, instead of using the first 12k characters.
- Map new uploads to existing topics and propose new ones.
- Resources: real YouTube links via the YouTube Data API (the AI must not invent URLs).
- Done alongside: AI provider abstraction (LlmProvider + OpenAiProvider), structured JSON outputs for lessons, and a fix for TXT/.doc uploads that the old file validator always rejected.
- Not yet: editing lesson text inline (students can regenerate with feedback or report mistakes instead).

## Phase 5 — Plans, assessment & adaptation ✅ done 2026-10-03
- Duration presets (5 weeks / 10 weeks / 3 months / custom); weekly targets + daily sessions; difficulty, confidence, credit units and quiz history as inputs.
- Assessments: short answer, structured, calculation and essay, with AI grading and feedback; basic → advanced difficulty.
- Adaptation: poor scores add revision and simpler content; good scores raise difficulty; revision intensifies near the exam; syllabus edits recalculate sessions.
- Flashcards generated from weak areas; exam-readiness score.
- Plans share study time across courses: each slot is split by credit units (boosted within 3 weeks of an exam) into non-overlapping windows, or rotated whole when splits would be too short. Exam dates are optional and can be added later.
- Not yet: calculation questions as their own type (they're short-answer questions with numeric answers).

## Phase 6 — Curriculum database & admin CMS
- Institution → faculty → programme → level → semester → course, with outline, credit units, source document, session, version, status (official / curated / AI).
- Admin dashboard to manage it; Edo State University pilot data entry.
- Suggestion hierarchy goes live: institution data → national framework (CCMAS) → AI.

## Phase 7 — Account integrity ⏸ deferred until email is set up on the domain (OTP needs it)
- Trusted devices (2–3), OTP for new devices, new-device alerts, device management in Settings, concurrent-session limits.

## Dependencies & open questions
- Phase 6 needs the EDSU prospectus/course data in hand.
- CCMAS data source for the level-2 tier.
- OTP channel for Phase 7 (email first; SMS costs money).
