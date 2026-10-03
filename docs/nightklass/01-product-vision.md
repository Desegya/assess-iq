# Nightklass — Product Vision, Homepage Critique & Functional Requirements

**Purpose:** consolidates the product vision, the homepage critique, and the revised functional requirements for Nightklass. Guides refinement of the landing page and implementation of the core study experience.

## 1. Product Vision

Nightklass is not just a flashcard or quiz app. It is an AI-powered personal study system that can help a student move from having little more than a course title or department name to having a structured syllabus, detailed learning content, a weekly or daily study plan, assessments, revision tools, progress tracking, and recommended learning resources.

**Core promise:** Nightklass turns a student's course information into a personalised path to exam readiness.

## 2. What Must Be Clear on the First Page

- What Nightklass is.
- Who it is for.
- What the student can do even without an uploaded syllabus.
- How Nightklass creates or organises learning content.
- How it plans study time and tracks progress.
- How it tests understanding and identifies weak areas.
- What the student should click next.

## 3. Critique of the Current First Page

The current first page is visually clean, modern and uncluttered. The headline "Study like the plan actually works." is strong and memorable. However, the page presents only a small part of the value proposition. It reads more like a login splash screen than the entry point to a complete AI learning platform.

**What currently works**
- Modern, credible dark visual style.
- Simple page with low cognitive load.
- Strong headline.
- Useful references to planning, quizzes and flashcards.
- Brand name is visible and memorable.

**What needs to change**

| Observation | Recommended correction |
|---|---|
| The product is not immediately explained | A first-time visitor should understand in seconds that Nightklass is an AI personal study coach, not just a planner or flashcard tool. |
| There is no strong call-to-action | Primary button such as "Start Studying Free" and a secondary action such as "See How It Works". |
| The largest differentiator is hidden | Nightklass can create a syllabus, generate detailed study content, build a study plan, assess the learner, and adapt the plan. This should be central. |
| The page feels too empty | Show a realistic product preview: today's study task, current progress, upcoming quiz, or next revision. |
| The current bullets undersell the product | The platform is much more than day-by-day planning, self-quizzing and flashcards. |
| "Never for a grade" is limiting | The platform will score assessments and give performance feedback. Wording should reflect formative grading and mastery tracking. |

## 4. Revised Homepage Positioning

- **Short descriptor:** Nightklass — Your AI Personal Study Coach
- **Hero headline:** Turn your course into a study plan that actually gets you exam-ready.
- **Hero copy:** Start with your department, course title, syllabus or uploaded materials. Nightklass can suggest likely courses, generate an editable syllabus, create detailed learning content, organise your study timetable, test your understanding, identify weak areas and adjust your plan as you progress.

**Supporting bullets**
- Get course suggestions based on your department and level.
- Generate or upload a syllabus and edit it at any time.
- Upload lecture notes, slides, PDFs, Word documents and textbooks.
- Generate detailed, interactive study content from your materials or with AI.
- Build a 5-week, 10-week or custom study plan with weekly and daily targets.
- Take quizzes from basic to advanced, including essay questions.
- Generate flashcards for retention and spaced revision.
- Receive recommended videos and supplementary resources.
- Track completion, weak areas, mastery and exam readiness.

**CTAs:** Primary — *Start Studying Free*. Secondary — *See How Nightklass Works*.

## 5. Core Course Creation Logic

The product must not assume every student already has a syllabus or course outline. A student should be able to enter at several points.

**Path A — Department and level only**
1. Student selects institution type, department/programme and level/year.
2. Nightklass suggests common or likely courses for that programme and level.
3. Student can select relevant courses, remove unsuitable ones, or add a custom course.
4. Suggested courses are presented as suggestions, not official institutional requirements.

**Path B — Course title only**
1. Student enters a course title, e.g. "Biostatistics", "Organic Chemistry", "Introduction to Economics".
2. Nightklass generates a suggested syllabus/course outline with modules, topics and subtopics.
3. Student can edit, delete, reorder or add topics at any point.
4. The syllabus is versioned so changes don't unexpectedly destroy existing study progress.

**Path C — Uploaded syllabus/course outline**
1. Student uploads a syllabus or course outline.
2. Nightklass extracts the course structure.
3. User reviews and confirms the extracted topics.
4. The confirmed structure becomes the working syllabus for planning and content generation.

**Path D — Uploaded learning materials**
Supported: lecture notes, slides/PowerPoint, PDFs, Word documents, textbooks, handouts, past questions (where permitted). Nightklass analyses these, infers the learning structure, and either enriches the existing syllabus or proposes a new editable syllabus.

## 6. Learning Content Generation

Nightklass generates detailed study content, not merely summaries or flashcards.

| Mode | Primary source | Expected behaviour |
|---|---|---|
| Material-grounded | Uploaded notes, slides, PDFs, Word files, textbooks | Generate content primarily from the student's materials and clearly indicate the source. |
| AI-generated | Confirmed syllabus/course outline | Generate accurate, level-appropriate content even with no uploaded notes or textbook. |
| Combined | Uploaded materials + syllabus + trusted academic knowledge | Use the student's material as context while filling gaps and adding explanations, examples and references. |

For every topic, Nightklass should be able to generate: learning objectives; clear introduction; detailed explanation; definitions and key concepts; examples and worked examples; practical/real-life applications; step-by-step explanations; diagrams or visual prompts where needed; summary and key takeaways; flashcards; knowledge checks and quizzes; essay or structured questions; revision recommendations; links to supplementary resources including YouTube videos.

## 7. Study Plan Generation

After the syllabus is established, the student chooses a duration: 5 weeks, 10 weeks, 3 months, or custom.

**Inputs:** number of topics and subtopics; available study days and times; exam date; course difficulty; student confidence; credit load or priority; previous quiz performance; missed sessions; time already spent.

**Output:** weekly topics; daily sessions; estimated duration; recommended material or AI content; assessment point after each session; revision points; progress status.

## 8. Adaptive Study Journey

The plan changes as the learner progresses.
- Missed session → propose a revised schedule.
- Poor performance → add revision and simpler explanations.
- Strong performance → harder questions or faster pace.
- Exam date approaching → increase priority and revision intensity.
- Syllabus edited → recalculate affected sessions.
- New document uploaded → link its content to relevant topics.

## 9. Assessment, Flashcards and Retention

Flashcards are one feature inside a larger system, not the product itself.

Assessment types: MCQ, true/false, short answer, calculation (where relevant), structured, essay. Difficulty from basic recall to advanced application.

After assessment: grade the student, explain errors, identify weak topics, recommend corrective learning, schedule revision. Then generate flashcards from important concepts and weak areas with spaced resurfacing.

## 10. Recommended External Learning Resources

Nightklass may recommend YouTube videos, open educational resources and articles. Recommendations must be topic-relevant, level-appropriate and preferably from credible educational sources.

## 11. AI Integration Principles

The AI is an engine inside Nightklass, not the user experience itself. Build structured prompts, retrieval from uploaded materials, content-source tracking, validation rules and product-specific workflows around it.

- Keep uploaded-source content distinguishable from AI-generated content.
- When the student chooses "use my materials", retrieve relevant sections from uploads before generating.
- Do not invent citations, textbook page numbers or institutional course requirements.
- Label course suggestions as suggestions unless sourced from an official curriculum.
- Allow users to regenerate, edit or report inaccurate content.
- Store the source and version of generated content where practical.
- Design so the AI provider can be swapped without redesigning the product.

## 12. First-Page Product Story

| Stage | What the student experiences |
|---|---|
| 1. Start anywhere | Department + level, course title, syllabus, or uploaded materials |
| 2. Build the course | Course suggestions or generate/edit a syllabus |
| 3. Learn | Detailed interactive content from uploads or AI |
| 4. Plan | Personalised 5-week, 10-week or custom schedule |
| 5. Test | Adaptive quizzes and essay assessments |
| 6. Improve | Weak areas and targeted revision |
| 7. Retain | Smart flashcards and spaced review |
| 8. Track | Completion, mastery and exam readiness |

## 13. Suggested First-Page Copy

- **Headline:** Study like the plan actually works.
- **Subheadline:** Start with your department, course title, syllabus or study materials. Nightklass builds your learning path, creates detailed study content, plans what to study, tests what you understand and adapts until exam day.
- **Feature lines:**
  - No syllabus yet? Generate one and edit it anytime.
  - Upload notes, slides, PDFs, Word documents or textbooks.
  - Turn your course into a personalised weekly and daily study plan.
  - Learn with detailed AI-generated or material-based explanations.
  - Test yourself, find weak areas and revise intelligently.
- **Alternative positioning line:** You bring the course. Nightklass plans, teaches, tests and tracks the rest.

## 14. Homepage Product Preview

Show a simplified dashboard preview instead of blank space, e.g.:

| | |
|---|---|
| TODAY'S STUDY | BIO 223 — Descriptive Statistics |
| Study target | Mean, median and mode |
| Duration | 45 minutes |
| Progress | 67% of weekly plan completed |
| Recent quiz | 8/10 — revise measures of dispersion |
| Next action | Continue lesson / Take revision quiz |

## 15. Developer Checklist

- [ ] Clear Nightklass descriptor near the logo
- [ ] Primary and secondary CTA
- [ ] Hero copy reflects the full product
- [ ] "No syllabus required" as a core message
- [ ] Department/level-based course suggestions
- [ ] Course-title-based syllabus generation
- [ ] Generated syllabi fully editable and version-aware
- [ ] Syllabus upload and topic extraction
- [ ] Notes, slides, PDF, Word and textbook uploads
- [ ] Detailed interactive content from uploaded materials
- [ ] Detailed content from the syllabus when no materials exist
- [ ] 5-week, 10-week and custom study plans
- [ ] Weekly topics and daily sessions
- [ ] Assessments with difficulty levels and essays
- [ ] Weak-area detection and adaptive revision
- [ ] Flashcards from learned content and weak areas
- [ ] Recommended YouTube/external resources
- [ ] Progress, mastery and exam-readiness tracking
- [ ] Realistic product preview on the landing page
- [ ] Modular AI service, not hard-coded to one provider

## 16. One-Sentence Definition

Nightklass is an AI-powered personal study coach that can build or interpret a course syllabus, generate detailed learning content, create an adaptive study plan, assess understanding, identify weak areas, support retention and track a student's progress toward exam readiness.

## 17. Core Principle

The student should never be blocked because they do not have a syllabus, notes or textbook. Nightklass should be useful from the moment the student knows only their department, level or course title, becoming increasingly personalised as they add official outlines and materials.
