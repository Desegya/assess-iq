# Nightklass exam preparation: pilot release checklist

Prepared 22 October 2026. This is a reviewable release checklist, not a claim of public deployment or official examination endorsement.

## Implemented pilot software

- One account, stage-appropriate onboarding and preserved tertiary records.
- WAEC/JAMB goals and subject workspaces across science, arts, commercial and other entered subjects.
- Shared teacher materials, private learner materials, source-aware lessons, topic practice, flashcards and study planning.
- Teacher-managed syllabus versions and objectives, curated/official provenance labels, source notes, draft review/publication and immutable published versions.
- Reviewed question bank, objective mappings, mathematical-operator-safe duplicate fingerprints and correction chains. Publishing a correction archives its predecessor; historical quiz/mock snapshots retain their keys.
- Restart-safe queued generation: at most 10 pending batches per creator, at most 10 questions per batch, bounded retries, live admin checks and atomic draft/job completion.
- JAMB mock specifications, complete four-subject forms, server timing, saved answers, recovery, review flags, idempotent submission and practice-labelled scores.
- WAEC text-based paper specifications by year/series/subject/paper, compulsory/optional sections, combined multipart responses, rubric partial credit and recoverable written marking.
- Learner syllabus coverage, evidence-based practice accuracy and weak-objective revision links. Objective-specific practice uses the private study topic so existing mastery/planning can adapt.
- Browser automation, isolated HTTP/PostgreSQL integration tests, backend unit tests and a CI workflow.

## Software verification

Final local results: 82 unit tests, 24 HTTP/PostgreSQL integration tests and 12 browser cases pass. Both production builds and TypeScript checks pass; all 19 local migrations are applied. Browser testing uses local Chrome desktop and an emulated mobile viewport, not a physical iPhone or Safari. It checks teacher publication/generation, secondary onboarding, syllabus practice, keyboard activation, JAMB saved-answer recovery, WAEC optional essays and cross-origin mutation rejection.

Integration tests include a full 180-question JAMB fixture, concurrent submission, late-save rejection, durable expiry, WAEC rubric/retry recovery, syllabus ownership, correction snapshots and idempotent generation jobs. A five-request concurrent-read smoke check is included. It is not a production capacity benchmark. All AI generation and written-marking test responses are deterministic stubs.

The new GitHub Actions workflow runs these checks on pull requests and main pushes using an isolated PostgreSQL service. Adding the workflow does not establish that it has run on GitHub; that requires pushing and inspecting its result.

## Content gates before inviting learners

The collaborating teacher needs to:

1. Enter applicable exam-year syllabuses and source/verification notes. Use CURATED for teacher-authored structures; mark OFFICIAL only after checking the underlying source. No official syllabus data was fabricated or pre-published by this implementation.
2. Link questions to the relevant objectives. Use queued generation with or without teaching notes, then review every item published to the shared bank.
3. Publish verified JAMB and WAEC paper specifications for the intended year/series. Confirm durations, counts, selection rules and marks against the actual applicable sources.
4. Supply enough reviewed questions for each advertised complete mock. The UI blocks incomplete forms and displays content shortfalls.
5. Review representative lessons and independently mark written-answer samples across subjects and ability levels. Compare paired marks and feedback before relying on automatic grading.

Calibration report input is an anonymized JSON array:

```json
[
  { "questionId": "sample-1", "maxMarks": 10, "teacherScore": 6, "aiScore": 5.5 }
]
```

After building the API, run:

```sh
node apps/api/scripts/exam-marking-calibration.cjs /path/to/paired-scores.json
```

This reports absolute error, normalized error, signed bias and agreement bands. No real teacher-marked dataset was provided in this session, so no real grading accuracy or calibration outcome is claimed. The script does not call AI or send student answers anywhere.

## Deployment gates

- Review the committed code and migrations. Local PostgreSQL is migrated; production is not.
- Run the migration deployment and regenerate the client in the target environment through the existing documented deployment workflow.
- Confirm HTTPS, allowed frontend origins, API/storage/AI settings, database backups and admin access.
- Keep at least one API process running for expiry, generation and grading recovery. Database leases coordinate workers across instances, but serverless request-only execution is insufficient for timely background processing.
- Start with an invited cohort and monitor saved-answer failures, marking retries, AI costs and reported content errors. Benchmark the chosen deployment at the agreed cohort concurrency before broader launch.
- Roll back by disabling publication/new starts for affected templates while preserving historical results and in-progress completion. Do not drop new tables to roll back.

Nothing has been pushed or deployed by this work. Production publishing remains a separate release action.

## Explicit limits and later enhancements

The pilot supports text-based examination practice. It does not reproduce physical practicals, oral/audio papers, diagram-dependent interactions, separate subpart answer/score controls or official examination grades. Images/audio and detailed examination-specific blueprints require further renderer and content work.

Same-name objectives within a subject reuse the personal learning topic, including across goals; differently named objectives are not automatically declared equivalent. Cross-exam curated equivalence mappings and automatic mock-to-plan objective updates remain enhancements. Mock evidence is visible in syllabus coverage; only objective-specific practice currently feeds the existing topic-mastery/adaptive-plan loop.

Question selection uses bounded candidate pools. Syllabus evidence reads bounded recent history (500 quizzes and 100 mock attempts per queried scope); these indicators are study aids, not exhaustive academic records. Comprehensive accessibility certification, physical-device coverage and production-scale load guarantees are not claimed.
