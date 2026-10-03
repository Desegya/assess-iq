# Nightklass — Onboarding, Course Setup & Curriculum Intelligence

**Core principle:** Nightklass should feel intelligent immediately after sign-up. The student should not have to build the academic structure manually when the platform can use their programme, level, semester and institution to suggest or retrieve relevant courses.

## 1. Objective

Refine the post-sign-up dashboard and "New Course" flow so Nightklass reflects the broader vision: a personalised AI study coach that understands the student's academic context, suggests likely courses, retrieves or generates course outlines, creates learning content, builds study plans, assesses understanding and tracks mastery.

## 2. Problem With the Current Dashboard

A new user sees zero courses, zero flashcards, zero weak spots and zero streaks before Nightklass has shown any value. "Pick a course and let's get a plan going" puts too much responsibility on the student.

**Change:** for a new user, replace the stats-first view with an onboarding dashboard that uses the academic profile to help build the semester. Example:

> Good afternoon, Asa 👋
> You're a 200-level Animal & Environmental Biology student. Let's set up your semester.

## 3. Academic Profile During Sign-Up

| Field | Status | Purpose |
|---|---|---|
| Country | Required | Curriculum context |
| Institution type | Required | University, polytechnic, college of education, secondary school, other |
| Programme/Department | Required | Drives course and curriculum suggestions |
| Current level | Required | Personalises likely courses |
| Current semester | Required | Filters relevant courses |
| Institution/School | Optional | Institution-specific curriculum retrieval |
| Faculty | Optional | Structured curriculum mapping |
| Academic session | Optional | Curriculum versioning |
| Expected graduation year | Optional | Longitudinal planning |

## 4. Curriculum Intelligence Hierarchy

Use the most authoritative available source first:

1. **Institution-specific curriculum** — if Nightklass has the school's prospectus, retrieve the actual courses for that institution, programme, level and semester.
2. **National curriculum framework** — otherwise use Nigerian frameworks such as CCMAS/BMAS or other recognised discipline frameworks.
3. **AI-generated suggestion** — if no verified source exists, AI suggests likely courses, clearly labelled as suggestions requiring confirmation.

> **Rule:** AI-generated course lists must never be presented as official university requirements unless backed by an official curriculum source.

## 5. Edo State University Pilot

Edo State University is the first institution-specific dataset. Prospectuses and departmental course information go into a structured curriculum database:

Institution → Faculty → Department/Programme → Level → Semester → Course code → Course title → Credit units → Official outline → Source document → Academic session/curriculum version

Example: *Edo State University → Faculty of Science → Animal & Environmental Biology → 200 Level → First Semester → BIO 223 – Biostatistics*

## 6. New User Dashboard

With no courses yet, help the student build the semester instead of showing zeros.

> **Let's build your semester.**
> AEB • 200 Level • First Semester
> We found courses commonly associated with your programme. Select the ones you are taking this semester.
> - View Suggested Courses
> - Add Course Manually
> - Upload Course Outline
>
> *No syllabus? No problem. Nightklass can generate an editable course outline and detailed study content for you.*

## 7. Suggested Course Selection Flow

1. Retrieve likely courses for institution + department + level + semester.
2. Show each as a selectable item with code and title.
3. Student ticks the courses actually being taken.
4. Remove irrelevant suggestions.
5. Add electives or carryover courses.
6. Search for a course not shown.

Students confirm rather than being auto-enrolled (carryovers, electives, transferred credits, curriculum variations).

## 8. "New Course" Screen Redesign

"Course title", "Subject" and "Description" duplicate each other. On "+ New Course", first show three pathways:

| Option | Purpose |
|---|---|
| 1. Choose from my programme | Courses suggested for your department, level and semester |
| 2. Add a course manually | Search or enter a course code/title |
| 3. Upload a course outline | Upload or photograph a syllabus and let Nightklass build the course |

## 9. Manual Course Fields

| Field | Behaviour |
|---|---|
| Course code or title | Single searchable field, e.g. BIO 223 / Biostatistics |
| Level | Required — course context and carryover handling |
| Semester | Required — organisation and curriculum matching |
| Course outline | Optional — upload, photograph, paste or generate |
| Credit unit | Optional initially — useful for prioritisation |

**Remove** Subject and Description from the initial form.

## 10. Course Outline Input Options

Optional, via: official outline from the Nightklass database; PDF; Word; PowerPoint/slides; image; photo of a prospectus/syllabus page; paste/type; generate with AI.

## 11. Carryover Logic

Student level and course level are stored separately. A 400-level student taking BIO 223 (200 level) → Nightklass detects the mismatch and may ask "Is this a carryover course?"

## 12. Outline Retrieval and Expansion

When a known course is selected, retrieve the official/curated outline first. Actions: Use this outline · Edit outline · Expand with AI · Replace outline · Upload lecturer-specific material.

## 13. Naming: "Boost Course Content"

Replace with **Expand Course Outline**, **Enrich Course Outline**, or **Expand with AI**. The original/official outline is always preserved; AI expansion creates a separate Nightklass learning outline.

## 14. Two-Layer Course Structure

| Layer | Purpose |
|---|---|
| Original / Official Course Outline | Exact curriculum or lecturer-provided structure |
| Nightklass Expanded Learning Outline | AI-enriched subtopics, explanations, examples and sequence |

## 15. Learning Content After Setup

Per topic: learning objectives; detailed interactive study note; definitions and key concepts; worked examples and step-by-step explanations; real-life/discipline applications; summary and takeaways; flashcards; YouTube/supplementary links; basic, intermediate and advanced quizzes; essay/structured questions; weak-area feedback and revision recommendations.

## 16. Uploaded Materials Enrich an Existing Course

Uploads are mapped to the course structure, not left as standalone files:
1. Student uploads a new BIO 223 slide deck.
2. Nightklass detects relevant topics.
3. Maps the material to existing syllabus sections.
4. Suggests adding any new concepts found.
5. Student confirms whether they go into the study plan.

## 17. Data Hierarchy

| Object | Contains |
|---|---|
| User | Academic profile, current level, semester, settings |
| Courses | Code, title, level, semester, credit unit |
| Original course outline | Official or user-provided structure |
| Expanded learning outline | AI-enriched structure |
| Uploaded materials | Notes, slides, PDFs, Word files, textbooks |
| Generated learning content | Detailed study content and explanations |
| Study plan | Weekly and daily schedule |
| Assessments | Quizzes, essays, mastery checks |
| Flashcards | Retention and spaced review |
| Progress/Mastery | Completion, weak areas, exam readiness |

## 18. Sidebar Navigation

| Section | Items |
|---|---|
| Main | Home • My Courses • Today • Study Plan |
| Learning | Assessments • Weak Areas • Flashcards • Resources |
| Progress | My Progress • GPA / Grades |
| Account | Profile • Settings |

## 19. Preventing Account Sharing

One account = one student, without locking to one device:
- 2–3 trusted devices per account.
- OTP verification for a new device.
- Restrict suspicious simultaneous sessions.
- Device-management screen under Settings.
- Alerts on new-device sign-in.
- Let the student log out unknown devices.
- Behavioural/session monitoring to flag unusual concurrent use.

User-facing message: *Nightklass learns how you learn. For accurate recommendations, progress tracking and assessments, each learner should use an individual account.*

## 20. Curriculum Management System (Admin)

Curriculum is not hard-coded. Authorised admins can: add/edit institutions, faculties, departments/programmes; upload prospectuses; add/edit course codes, titles and outlines; assign levels and semesters; add credit units; store source documents; mark content as official, curated or AI-generated; set curriculum year/version; deactivate outdated curricula; publish revised versions.

## 21. Curriculum Versioning

Store more than course name + institution. Example record:
- Institution: Edo State University
- Programme: B.Sc. Animal & Environmental Biology
- Course: BIO 223
- Academic session/curriculum: 2026/2027
- Source: Departmental Prospectus
- Version: 1.0
- Status: Current

## 22. End-to-End Journey

1. Sign up → 2. Academic profile → 3. Institution → Department → Level → Semester → 4. Suggested courses → 5. Select / add manually / upload syllabus → 6. Retrieve or generate outline → 7. Review/edit outline → 8. Expand with AI → 9. Upload notes/slides/textbooks → 10. Generate learning content → 11. Choose 5 weeks / 10 weeks / exam date / custom → 12. Generate study plan → 13. Daily study → 14. Assessment → 15. Feedback and grading → 16. Weak areas → 17. Schedule revision → 18. Flashcards/spaced repetition → 19. Track mastery and exam readiness

## 23. Developer Checklist

- [ ] Academic profile onboarding after sign-up
- [ ] Replace empty new-user dashboard with semester setup flow
- [ ] Institution/department/level/semester course suggestions
- [ ] Curriculum-source hierarchy: institution → national framework → AI suggestion
- [ ] Simplify New Course screen
- [ ] Remove Subject and Description from the initial form
- [ ] One searchable course code/title field
- [ ] Keep course level and semester for carryover handling
- [ ] Outline upload by PDF, Word, slides, image, photo and pasted text
- [ ] "Use university outline" and "Generate with AI" options
- [ ] Three-path New Course flow
- [ ] Preserve official outline separately from AI-expanded outline
- [ ] Map uploaded materials to existing topics
- [ ] Curriculum management admin dashboard
- [ ] Curriculum versioning
- [ ] Sidebar prioritises My Courses and Study Plan
- [ ] Trusted-device and account-sharing controls

## 24. Core Principle

Nightklass should reduce academic setup work. The more it already knows about the student's programme, curriculum and course, the less the student should have to type.
