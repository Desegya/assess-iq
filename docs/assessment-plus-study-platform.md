# AssessIQ: From Assessment Platform to Assessment + Study Platform

## 1. Why this doc exists

AssessIQ started as a teacher-driven assessment tool: upload notes → AI generates questions → teacher reviews → students take a test → teacher sees results and weak topics. That loop is largely built and working.

We're expanding scope. AssessIQ is no longer just the assessment side of that loop — it's also the **study side**: helping the student plan what to learn, actually learn it, and self-test before the teacher's assessment ever happens. The two halves share data (courses, topics, questions, AI generation) but serve different moments — teacher-assigned evaluation vs. student self-directed learning.

This doc states what needs to be built to make that merge real, grounded in what already exists in the codebase (not a rewrite, not a new stack — an extension).

## 2. Current state (what's already built)

**Backend modules** (`apps/api/src/modules/`): `auth`, `organizations`, `users`, `courses`, `documents`, `questions`, `assessments`, `attempts`, `ai`, `analytics`, `admin`, `storage`, `study` (empty stub).

**Data model** (`packages/db/prisma/schema.prisma`) covers: multi-tenant orgs, users/roles (SUPER_ADMIN/ORG_ADMIN/TEACHER/STUDENT), courses, topics (hierarchical, no progress fields), documents (upload → extract → chunk), questions (MCQ/short-answer/theory/true-false, difficulty, Bloom level, AI-generated flag), assessments + assessment questions, attempts + answers, integrity events (proctoring), AI usage logs, and a bare-bones `Flashcard` model (front/back only, no scheduling).

**What's missing entirely** — confirmed absent from schema and code:
- Study plans / study sessions / study calendar
- Topic mastery or progress tracking of any kind
- Spaced repetition (Flashcard has no due-date/interval/ease fields)
- AI tutoring or conversational chat (AI module only does one-shot generation: questions, summaries, flashcards, topic extraction, quality review, weak-topic suggestion)
- Student-set exam dates / available study time
- Subscription/billing model (plan is just an enum on Organization)

The `study` module and its web route are scaffolded but empty — this is genuinely greenfield, not a refactor.

## 3. What "assessment + study" means in product terms

Two loops, sharing one data spine (Organization → Course → Topic → Document → Question):

| | Assessment loop (exists) | Study loop (to build) |
|---|---|---|
| Driven by | Teacher | Student |
| Trigger | Teacher creates assessment | Student sets exam date + available hours |
| AI's job | Generate questions from notes for teacher to review | Turn a course outline into a study plan; generate self-quizzes on demand |
| Output | Score, integrity flags, class analytics | Daily tasks, weak-topic list, confidence tracking |
| Grading | Counts toward teacher's record | Formative only — never an official grade |

A student's weak topics from *self-quizzes* should be visible signal for teacher-side analytics too, and questions the AI generates for study quizzes should be able to draw from the same approved question bank teachers build — the two loops should reinforce each other, not duplicate content.

## 4. Scope: the core journey to build first

Adapting the original study-platform spec's own recommended prototype journey (not the full 21-feature list, which is really a multi-phase roadmap mislabeled as one MVP):

> Student opens a course → sets exam date + daily available study hours → AI turns the course's topics into a study plan → student sees today's task → completes it → takes a short self-quiz on that topic → sees score + which concepts were weak → next day's plan adjusts accordingly.

This is deliberately student-only, single-course-at-a-time in v1, and reuses existing Course/Topic/Document/Question/AI infrastructure rather than inventing new content pipelines.

## 5. Gap list — what needs to be built

**Data model additions** (extends existing Prisma schema, same patterns already in use):
- `StudyAvailability` — studentId, dayOfWeek, startTime, endTime, maxMinutes
- `StudyPlan` — studentId, courseId, examDate, startDate, status, version
- `StudySession` — studyPlanId, topicId, scheduledDate, startTime/endTime, status (not_started/in_progress/completed/missed/rescheduled), confidenceRating
- `TopicMastery` — studentId, topicId, masteryScore, quizAverage, lastAssessedAt
- Extend `Topic` with `estimatedMinutes` and `importanceWeight` (needed for plan generation math)
- Extend `Flashcard` with spaced-repetition fields if spaced revision is wanted in v1 (due date, interval, ease) — otherwise defer

**Backend work:**
- Flesh out the `study` module: endpoints to set availability/exam date, generate a plan, fetch today's tasks, mark session complete, trigger a topic self-quiz
- Plan-generation logic: given topics + available hours + exam date, produce a day-by-day schedule (this is new algorithmic work, not AI-generated — deterministic scheduling, AI only helps weight difficulty/importance)
- Reuse `ai.service.ts`'s question generation for self-quizzes, tagged as student-initiated (vs teacher-initiated) so it doesn't pollute the teacher's review queue
- Weak-topic detection: derive from self-quiz scores + confidence ratings, write into `TopicMastery`

**Frontend work (student side):**
- Exam date + availability setup screens
- Study plan view / daily task view
- Self-quiz flow reusing existing assessment-taking UI where possible
- Weak-topics view

**Explicitly deferred (not in this phase):**
- Parent role and parent portal
- Teacher/institution-facing view of study-loop analytics (revisit once the loop itself works)
- Conversational AI tutor / chat assistant
- Spaced-repetition flashcard scheduling
- Notifications/reminders beyond what's minimally needed to test the loop
- Any subscription/billing changes

## 6. Open questions

- Should student self-quiz questions be pulled from the *same* AI-generated question pool teachers review, or generated fresh and kept separate until proven reliable?
- Does `TopicMastery` need to roll up into teacher-facing class analytics in this phase, or stay student-only for now?
- Is multi-course study planning (balancing several courses at once, per the original spec) needed for v1, or is single-course sufficient to validate the loop?
