# Course setup and management

The course library reads the full server list with `cache: no-store`. It reloads when the route changes, the browser tab regains focus, or a suspended page is restored. Responses from older requests cannot overwrite a newer list or reinsert a deleted course. Both Dashboard and My Courses use the same hook.

Every course card exposes Edit course and Delete course. A course page also has a selector for switching between saved courses. Switching remounts that course workspace so draft topics, errors and planning state cannot carry over from another course. Delete asks for confirmation. Courses linked to an exam goal must first be removed through that goal's Edit subjects flow.

Adding a manual course, uploading an outline, accepting programme suggestions, and selecting WAEC/JAMB subjects were inspected. None intentionally replaces the learner's complete course list. A failed batch of programme additions now deselects already-saved courses so retrying adds only the remaining choices. The original report of a missing course was not reproduced as a database overwrite; list freshness and the regression checks address the observed risk without claiming a proven cause.

## Guided setup

The course chooser opens a short, collapsible three-step guide. The example button fills the form without creating any records. The learner can edit it, enter an optional exam date, and see what happens after Create course. Help disclosures work with touch and keyboard input. A full Quick guide is linked from the sidebar and course guides.

The optional target exam date is saved on the course. It preselects the exam-date option in Study setup; without a date, the semester plan remains available. Editing the course can change or clear this suggestion. Existing plans keep their own date and must be rescheduled on the plan page. Dates must be future calendar dates in Africa/Lagos; unrelated edits can retain an unchanged historical target date.

## Deployment and checks

Apply the additive `20261030120000_course_target_exam_date` database migration **before running the new API**:

```sh
npm run db:migrate:deploy --workspace=@assessiq/db
```

Regenerate the Prisma client during the build. The migration was checked with Prisma's schema diff; it adds only a nullable DATE column. No existing course records are rewritten.

`npm run test:e2e:courses --workspace=@assessiq/nightklass` covers desktop and mobile course additions, an outline upload, AI-assisted creation, partial-batch retries, switching, editing, deletion, tab refresh and the guided example/date flow using mocked API responses. API unit tests cover date validation and retaining multiple owned courses; the exam-preparation suite checks subject-course reuse and goal-scoped changes. These tests do not read production learner data.
