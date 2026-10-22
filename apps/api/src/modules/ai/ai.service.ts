import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { LLM_PROVIDER, type LlmMessage, type LlmProvider } from './providers/llm-provider'
import { QuestionDifficulty, QuestionType } from '@assessiq/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawGeneratedQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  questionText: string
  options?: { key: string; text: string }[]
  correctAnswer: string
  explanation?: string
  marks?: number
}

export interface WrittenAnswerToGrade {
  id: string
  type: 'SHORT_ANSWER' | 'THEORY'
  question: string
  modelAnswer: string
  marks: number
  studentAnswer: string
}

export interface WrittenAnswerGrade {
  id: string
  score: number
  feedback: string
  missingPoints: string[]
}

export interface RawExtractedTopic {
  name: string
  description?: string
  subtopics?: string[]
}

export interface RawExpandedTopic {
  topic: string
  subtopics: { name: string; description?: string }[]
}

export interface RawSuggestedCourse {
  courseCode?: string
  title: string
  creditUnits?: number
}

export interface LessonContent {
  objectives: string[]
  introduction: string
  sections: { heading: string; body: string }[]
  keyTerms: { term: string; definition: string }[]
  workedExamples: { title: string; problem: string; steps: string[]; answer: string }[]
  applications: string[]
  diagramIdeas: string[]
  summary: string[]
  examQuestions: { question: string; type: 'short' | 'structured' | 'essay' | 'calculation' }[]
}

const str = { type: 'string' }
const strList = { type: 'array', items: str }
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

// Property order matters: the model writes fields in this order, so the detailed sections come before the summary
const LESSON_SCHEMA = obj({
  objectives: strList,
  introduction: str,
  sections: { type: 'array', items: obj({ heading: str, body: str }) },
  keyTerms: { type: 'array', items: obj({ term: str, definition: str }) },
  workedExamples: { type: 'array', items: obj({ title: str, problem: str, steps: strList, answer: str }) },
  applications: strList,
  diagramIdeas: strList,
  summary: strList,
  examQuestions: {
    type: 'array',
    items: obj({ question: str, type: { type: 'string', enum: ['short', 'structured', 'essay', 'calculation'] } }),
  },
})

export interface LessonExcerpt {
  id: string // "S1", "S2"… — the only citation markers the model may use
  source: string
  text: string
}

export interface RawFlashcard {
  front: string
  back: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GenerateOptions {
  count: number
  types: QuestionType[]
  difficulty: QuestionDifficulty
  topicHint?: string
  userId: string
  organizationId?: string
  documentId: string
  // false = the text is only a course/topic description, so the model should draw on general knowledge
  groundedInMaterial?: boolean
}

interface ExtractTopicsOptions {
  userId: string
  organizationId?: string
  documentId: string
}

interface GenerateFlashcardsOptions {
  count: number
  topicHint?: string
  userId: string
  organizationId?: string
  documentId: string
  groundedInMaterial?: boolean
}

interface CourseGenerationOptions {
  userId: string
  organizationId?: string
  relatedEntityId: string
}

type ChatOptions = CourseGenerationOptions

type AiAction =
  | 'GENERATE_QUESTIONS'
  | 'GENERATE_SUMMARY'
  | 'GENERATE_FLASHCARDS'
  | 'EXTRACT_TOPICS'
  | 'ANSWER_QUESTION'
  | 'EMBED_CONTENT'
  | 'RECOMMEND_RESOURCES'
  | 'REVIEW_QUALITY'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
  ) {}

  // ─── Generate questions from extracted document text ──────────────────────

  async generateQuestions(
    extractedText: string,
    opts: GenerateOptions,
  ): Promise<RawGeneratedQuestion[]> {
    // Take a representative slice of the text (avoid hitting token limits)
    const prompt = this.buildPrompt(extractedText.slice(0, 12000), opts)
    const output = await this.complete(prompt, 4096, 'GENERATE_QUESTIONS', { ...opts, relatedEntityId: opts.documentId })
    const questions = this.parseJsonArray<RawGeneratedQuestion>(output)
    this.logger.log(`Generated ${questions.length} questions for ${opts.documentId}`)
    return questions
  }

  // ─── Extract candidate topics from extracted document text ────────────────

  async extractTopics(
    extractedText: string,
    opts: ExtractTopicsOptions,
  ): Promise<RawExtractedTopic[]> {
    const textSlice = extractedText.slice(0, 12000)
    const prompt = `You are an expert curriculum designer. Read the course material below and break it
into a short, ordered list of study topics a student could plan revision sessions around.

- Produce between 4 and 12 topics, in the order they appear in the text
- Each topic name should be concise (under 8 words)
- Include a one-sentence description of what the topic covers
- If the text lists subtopics under a topic, include them (short names); otherwise use an empty array
- Use the text's own wording for topic names where it has clear headings

Return ONLY a valid JSON array — no markdown, no explanation, just the array.
Each item must match: {"name":"...","description":"...","subtopics":["...","..."]}

TEXT TO USE:
${textSlice}`

    const output = await this.complete(prompt, 2048, 'EXTRACT_TOPICS', { ...opts, relatedEntityId: opts.documentId })
    const topics = this.parseJsonArray<RawExtractedTopic>(output)
    this.logger.log(`Extracted ${topics.length} topics for ${opts.documentId}`)
    return topics
  }

  // ─── Generate flashcards from extracted document text ─────────────────────

  async generateFlashcards(
    extractedText: string,
    opts: GenerateFlashcardsOptions,
  ): Promise<RawFlashcard[]> {
    const textSlice = extractedText.slice(0, 12000)
    const grounded = opts.groundedInMaterial !== false
    const prompt = `You are an expert tutor creating spaced-repetition flashcards ${
      grounded ? 'from study material' : 'for the specified academic context'
    }.

Generate exactly ${opts.count} flashcards ${
      grounded
        ? 'from the text below'
        : 'using your own knowledge of the course and topic described below, at the depth specified in the course context'
    }${opts.topicHint ? ` focused on: ${opts.topicHint}` : ''}.
- Each card should test one clear fact, definition, or concept
- The front should be a short question or prompt; the back should be a concise, correct answer
- Avoid duplicating the same fact across cards

Return ONLY a valid JSON array — no markdown, no explanation, just the array.
Each item must match: {"front":"...","back":"..."}

${grounded ? 'TEXT TO USE' : 'COURSE AND TOPIC'}:
${textSlice}`

    const output = await this.complete(prompt, 2048, 'GENERATE_FLASHCARDS', { ...opts, relatedEntityId: opts.documentId })
    const cards = this.parseJsonArray<RawFlashcard>(output)
    this.logger.log(`Generated ${cards.length} flashcards for ${opts.documentId}`)
    return cards
  }

  // ─── Suggest topics for a course from its title alone (no material) ───────

  async suggestCourseTopics(courseDescription: string, opts: CourseGenerationOptions): Promise<RawExtractedTopic[]> {
    const prompt = `You are an expert curriculum designer. A student has added the course below but has
no slides or notes yet. Using your knowledge of how this course is typically taught at the academic level specified in the course context,
break it into an ordered list of study topics the student could plan revision sessions around.

- Produce between 6 and 12 topics, in the order they are usually taught
- Each topic name should be concise (under 8 words)
- Include a one-sentence description of what the topic covers
- Give each topic 2-5 subtopics (short names) that a student would study within it
- Favour the topics most likely to appear in exams

Return ONLY a valid JSON array — no markdown, no explanation, just the array.
Each item must match: {"name":"...","description":"...","subtopics":["...","..."]}

COURSE:
${courseDescription}`

    const output = await this.complete(prompt, 2048, 'EXTRACT_TOPICS', opts)
    return this.parseJsonArray<RawExtractedTopic>(output)
  }

  // ─── Expand an outline with AI subtopics (the Nightklass learning layer) ──

  async expandOutline(
    courseDescription: string,
    topics: { name: string; description?: string | null }[],
    material: string | null,
    opts: CourseGenerationOptions,
  ): Promise<RawExpandedTopic[]> {
    const topicList = topics.map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n')
    const prompt = `You are an expert tutor turning a course outline into a detailed learning sequence.
For each topic below, list the subtopics a student should work through, in the order they should learn them.

- Give 3-6 subtopics per topic, each with a concise name (under 8 words) and a one-sentence description
- Stay within the scope of each topic; don't repeat the topic name as a subtopic
- Keep the exact topic names as given in the "topic" field
${material ? '- Use the course material provided to match what the lecturer covers' : '- Use your knowledge of how this course is typically taught at the academic level specified in the course context'}

Return ONLY a valid JSON array — no markdown, no explanation, just the array.
Each item must match: {"topic":"<exact topic name>","subtopics":[{"name":"...","description":"..."}]}

COURSE:
${courseDescription}

TOPICS:
${topicList}${material ? `\n\nCOURSE MATERIAL:\n${material.slice(0, 10000)}` : ''}`

    const output = await this.complete(prompt, 4096, 'EXTRACT_TOPICS', opts)
    return this.parseJsonArray<RawExpandedTopic>(output)
  }

  // ─── Read a photographed outline/prospectus page ──────────────────────────

  async extractOutlineFromImage(
    image: Buffer,
    mimeType: string,
    opts: CourseGenerationOptions,
  ): Promise<{ transcription: string; topics: RawExtractedTopic[] }> {
    const prompt = `This is a photo or scan of a course outline, syllabus or prospectus page.

1. Transcribe the course content faithfully (headings, topics, subtopics). Skip page furniture like page numbers.
2. Break it into an ordered list of study topics with any subtopics listed under each.

- Each numbered or headed item is a topic: copy its heading text exactly as the topic name (without the list number or bullet), even if it is broad
- Lines indented or bulleted beneath a heading are its subtopics; never promote a subtopic to replace its heading
- If the image is unreadable or isn't a course outline, return an empty topics array

Return ONLY a valid JSON object — no markdown, no explanation.
It must match: {"transcription":"...","topics":[{"name":"...","description":"...","subtopics":["..."]}]}`

    const output = await this.complete(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', mimeType, data: image },
          ],
        },
      ],
      4096,
      'EXTRACT_TOPICS',
      opts,
    )
    const parsed = this.parseJsonObject<{ transcription?: string; topics?: RawExtractedTopic[] }>(output)
    return { transcription: parsed.transcription ?? '', topics: Array.isArray(parsed.topics) ? parsed.topics : [] }
  }

  // ─── Suggest likely courses for a student's programme, level and semester ─

  async suggestProgrammeCourses(
    studentContext: string,
    existingTitles: string[],
    opts: CourseGenerationOptions,
  ): Promise<RawSuggestedCourse[]> {
    const prompt = `You are an academic adviser familiar with Nigerian higher-education curricula (including the
NUC CCMAS framework). Suggest the courses this student is most likely taking this semester.

- Suggest between 6 and 12 courses typical for this programme, level and semester
- Include core departmental courses first, then common faculty or general studies (GST) courses
- Use the usual Nigerian course-code style (e.g. "BIO 201"); codes vary by institution, so pick the most typical
- Give typical credit units (1-6) for each
- Do NOT include any of these, which the student already has: ${existingTitles.length ? existingTitles.join('; ') : 'none'}

Return ONLY a valid JSON array — no markdown, no explanation, just the array.
Each item must match: {"courseCode":"...","title":"...","creditUnits":3}

STUDENT:
${studentContext}`

    const output = await this.complete(prompt, 2048, 'EXTRACT_TOPICS', opts)
    return this.parseJsonArray<RawSuggestedCourse>(output)
  }

  // ─── Generate a structured lesson for a topic ─────────────────────────────

  async generateLesson(
    courseDescription: string,
    topic: { name: string; description?: string | null; subtopics: string[] },
    excerpts: LessonExcerpt[],
    opts: CourseGenerationOptions & { mode: 'MATERIAL' | 'AI' | 'COMBINED'; feedback?: string },
  ): Promise<LessonContent> {
    const sourceRules = {
      MATERIAL: `Use ONLY the numbered excerpts from the student's own material. If something isn't covered there, leave it out
rather than adding outside knowledge. Cite the excerpt you used at the end of the sentence, like [S2].`,
      COMBINED: `Ground the lesson in the numbered excerpts from the student's own material and cite them like [S2] wherever you
use them. Fill important gaps with accurate, level-appropriate knowledge, but never attach a citation to content that
didn't come from an excerpt.`,
      AI: `The student has no material for this topic, so teach it from accurate knowledge appropriate to the academic level specified in the course context.
Do not include any citation markers.`,
    }[opts.mode]

    const prompt = `You are an expert tutor writing a complete, self-contained lesson a student can learn from.

COURSE:
${courseDescription}

TOPIC: ${topic.name}${topic.description ? `\nScope: ${topic.description}` : ''}${
      topic.subtopics.length ? `\nSubtopics to cover, in order: ${topic.subtopics.join('; ')}` : ''
    }

SOURCE RULES:
${sourceRules}
- Never invent textbook titles, page numbers, authors, URLs or institutional requirements.
${opts.feedback ? `\nThe student flagged a problem with the previous version of this lesson — fix it:\n"${opts.feedback}"\n` : ''}
CONTENT:
- objectives: 3-5 learning objectives ("By the end you should be able to…" style, without that prefix)
- introduction: 2-4 sentences on what the topic is and why it matters
- sections: ${
      topic.subtopics.length
        ? `EXACTLY ${topic.subtopics.length} sections, one per subtopic listed above, in that order, each headed with the subtopic name`
        : '3-6 sections in a logical learning order'
    }. Each section is a detailed explanation in Markdown (paragraphs, bullet points, step-by-step reasoning,
  formulas where relevant), 150-350 words. Write formulas in plain text (e.g. s² = Σ(x − x̄)² / (n − 1)), not LaTeX
- keyTerms: the essential definitions
- workedExamples: 1-3 worked examples with numbered steps where the topic involves calculation or method; use an
  empty array for purely descriptive topics
- applications: 2-4 practical or discipline-specific applications
- diagramIdeas: 0-3 short descriptions of diagrams that would help (what to draw and label)
- summary: 4-6 key takeaways
- examQuestions: 3-5 likely exam questions, each typed short, structured, essay or calculation

Respond with the lesson as JSON.${
      excerpts.length
        ? `\n\nEXCERPTS FROM THE STUDENT'S MATERIAL:\n${excerpts.map(e => `[${e.id}] (${e.source})\n${e.text}`).join('\n\n')}`
        : ''
    }`

    const output = await this.complete(prompt, 10000, 'GENERATE_SUMMARY', opts, undefined, {
      name: 'lesson',
      schema: LESSON_SCHEMA,
    })
    return this.parseJsonObject<LessonContent>(output)
  }

  // ─── Find concepts in new material that the outline doesn't cover yet ─────

  async findUncoveredTopics(
    existingTopics: string[],
    material: string,
    opts: CourseGenerationOptions,
  ): Promise<{ name: string; description?: string }[]> {
    const prompt = `A student uploaded new course material. Compare it with their existing course outline and list
substantial topics the material teaches that the outline doesn't cover yet.

- Think in outline-level topics, the size of a lecture or a chapter section, not individual facts
- Group a method with its formulas, assumptions and follow-up tests into ONE topic (e.g. "One-way ANOVA", not
  separate topics for its F statistic and assumptions)
- Details, corrections or examples that belong inside an existing topic count as covered (e.g. Bessel's correction
  is part of variance)
- Only include topics that get real coverage in the material (not passing mentions)
- At most 3 topics, each with a concise name (under 8 words) and a one-sentence description
- Return an empty array if everything is already covered

Return ONLY a valid JSON array — no markdown, no explanation. Each item: {"name":"...","description":"..."}

EXISTING OUTLINE:
${existingTopics.map(t => `- ${t}`).join('\n') || '(empty)'}

NEW MATERIAL:
${material.slice(0, 12000)}`

    const output = await this.complete(prompt, 1024, 'EXTRACT_TOPICS', opts)
    return this.parseJsonArray<{ name: string; description?: string }>(output)
  }

  // ─── Pick the most suitable videos from search results ────────────────────

  async rankVideos(
    context: string,
    videos: { id: string; title: string; channel: string; description: string }[],
    opts: CourseGenerationOptions,
  ): Promise<string[]> {
    const prompt = `Choose the best videos for a university student studying the topic below.
Prefer clear, accurate explanations from educational channels or universities at roughly university level.
Drop anything off-topic, clickbait, too basic (school-level) or not in English. Pick at most 4.

Return ONLY a JSON array of the chosen video ids, best first, e.g. ["abc123","def456"].

TOPIC:
${context}

VIDEOS:
${videos.map(v => `${v.id} | ${v.title} | ${v.channel} | ${v.description.slice(0, 150)}`).join('\n')}`

    const output = await this.complete(prompt, 300, 'RECOMMEND_RESOURCES', opts)
    return this.parseJsonArray<string>(output).filter(id => typeof id === 'string')
  }

  // ─── Grade written answers against model answers / marking schemes ────────

  async gradeWrittenAnswers(
    answers: WrittenAnswerToGrade[],
    context: string,
    opts: CourseGenerationOptions,
  ): Promise<WrittenAnswerGrade[]> {
    const prompt = `You are a fair, encouraging university examiner marking a student's self-test.

${context}

For each answer, award marks out of the maximum using the model answer or marking scheme:
- Give credit for correct ideas expressed in different words; don't require exact wording
- For calculations, give method marks for correct working even if the final value is wrong
- Award 0 for blank, irrelevant or entirely wrong answers
- feedback: 1-3 sentences to the student — what they got right, then what to fix
- missingPoints: key points from the marking scheme the answer missed (empty if full marks)

Respond with a JSON object containing "grades", one per answer, using the same ids.

ANSWERS:
${answers
  .map(
    a => `--- id: ${a.id} (${a.type === 'THEORY' ? 'structured/essay' : 'short answer'}, max ${a.marks} marks)
QUESTION: ${a.question}
MODEL ANSWER / MARKING SCHEME: ${a.modelAnswer}
STUDENT ANSWER: ${a.studentAnswer.trim() || '(blank)'}`,
  )
  .join('\n\n')}`

    const output = await this.complete(prompt, 3000, 'REVIEW_QUALITY', opts, undefined, {
      name: 'grades',
      schema: {
        type: 'object',
        properties: {
          grades: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                score: { type: 'number' },
                feedback: { type: 'string' },
                missingPoints: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'score', 'feedback', 'missingPoints'],
              additionalProperties: false,
            },
          },
        },
        required: ['grades'],
        additionalProperties: false,
      },
    })
    const parsed = this.parseJsonObject<{ grades: WrittenAnswerGrade[] }>(output)
    const max = new Map(answers.map(a => [a.id, a.marks]))
    // Clamp scores to the valid range in case the model over- or under-shoots
    return (parsed.grades ?? [])
      .filter(g => max.has(g.id))
      .map(g => ({ ...g, score: Math.min(max.get(g.id)!, Math.max(0, Math.round(g.score * 2) / 2)) }))
  }

  // ─── Study chat — answer a question grounded in course material ───────────

  async chat(messages: ChatMessage[], systemContext: string, opts: ChatOptions): Promise<string> {
    return this.complete(messages, 1024, 'ANSWER_QUESTION', opts, systemContext)
  }

  // ─── Embeddings (retrieval over uploaded material) ────────────────────────

  async embed(texts: string[], opts: CourseGenerationOptions): Promise<number[][]> {
    this.assertConfigured()
    const start = Date.now()
    let usage = { model: 'unknown', inputTokens: 0, costUsd: 0 }
    let errorMessage: string | undefined
    try {
      const result = await this.provider.embed(texts)
      usage = result
      return result.vectors
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      await this.logUsage('EMBED_CONTENT', opts, {
        ...usage,
        outputTokens: 0,
        durationMs: Date.now() - start,
        errorMessage,
      })
    }
  }

  // ─── Shared completion call with usage logging ────────────────────────────

  private assertConfigured() {
    if (!this.provider.isConfigured()) {
      throw new BadRequestException(
        `AI provider "${this.provider.name}" is not configured. Add its API key to apps/api/.env to use AI features.`,
      )
    }
  }

  private async complete(
    input: string | LlmMessage[],
    maxOutputTokens: number,
    action: AiAction,
    opts: CourseGenerationOptions,
    instructions?: string,
    jsonSchema?: { name: string; schema: Record<string, unknown> },
  ): Promise<string> {
    this.assertConfigured()
    const start = Date.now()
    let usage = { model: 'unknown', inputTokens: 0, outputTokens: 0, costUsd: 0 }
    let errorMessage: string | undefined
    try {
      const result = await this.provider.complete({ input, instructions, maxOutputTokens, jsonSchema })
      usage = result
      return result.text
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      await this.logUsage(action, opts, { ...usage, durationMs: Date.now() - start, errorMessage })
    }
  }

  private async logUsage(
    action: AiAction,
    opts: CourseGenerationOptions,
    u: { model: string; inputTokens: number; outputTokens: number; costUsd: number; durationMs: number; errorMessage?: string },
  ) {
    await this.prisma.aIUsageLog
      .create({
        data: {
          organizationId: opts.organizationId,
          userId: opts.userId,
          action,
          model: u.model,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          costUsd: u.costUsd,
          durationMs: u.durationMs,
          success: !u.errorMessage,
          errorMessage: u.errorMessage,
          relatedEntityId: opts.relatedEntityId,
        },
      })
      .catch(e => this.logger.error('Failed to save AI usage log', e))
  }

  // ─── Prompt builder ───────────────────────────────────────────────────────

  private buildPrompt(text: string, opts: GenerateOptions): string {
    const typeDescriptions = opts.types
      .map(t => {
        if (t === QuestionType.MCQ)
          return 'MCQ (4 options A/B/C/D, one correct)'
        if (t === QuestionType.TRUE_FALSE)
          return 'TRUE_FALSE (options: A=True, B=False)'
        if (t === QuestionType.SHORT_ANSWER)
          return 'SHORT_ANSWER (brief written answer, or a calculation with a numeric answer where the topic involves calculation)'
        if (t === QuestionType.THEORY)
          return 'THEORY (a structured or essay question worth 5-10 marks, with a marking scheme)'
        return t
      })
      .join(', ')

    const grounded = opts.groundedInMaterial !== false

    return `You are an expert educator creating exam questions ${
      grounded ? 'from educational content' : 'for the specified academic context'
    }.

Generate exactly ${opts.count} exam questions ${
      grounded
        ? 'from the text below'
        : 'using your own knowledge of the course and topic described below, at the level specified in the course context'
    }.
- Difficulty: ${opts.difficulty} (EASY = recall and definitions, MEDIUM = understanding and application, HARD = analysis, multi-step problems and evaluation)
- Question types to use: ${typeDescriptions}${opts.topicHint ? `\n- Focus on topic: ${opts.topicHint}` : ''}
- Distribute question types roughly evenly across the types listed
- Make questions clear, unambiguous, and ${grounded ? 'directly based on the text' : 'factually accurate'}
- For MCQ: always provide exactly 4 options (A, B, C, D)
- For TRUE_FALSE: options must be exactly [{"key":"A","text":"True"},{"key":"B","text":"False"}]

Return ONLY a valid JSON array — no markdown, no explanation, just the array.

Each item must match one of these schemas:

MCQ / TRUE_FALSE:
{"type":"MCQ","questionText":"...","options":[{"key":"A","text":"..."},...],"correctAnswer":"A","explanation":"...","difficulty":"${opts.difficulty}"}

SHORT_ANSWER:
{"type":"SHORT_ANSWER","questionText":"...","correctAnswer":"<model answer; for calculations the final value with units>","explanation":"<working or reasoning>","difficulty":"${opts.difficulty}"}

THEORY:
{"type":"THEORY","questionText":"<question; structured questions use parts (a), (b), (c) with marks in brackets>","correctAnswer":"<marking scheme: the points a full answer must make, with marks per point>","explanation":"<a model answer>","marks":8,"difficulty":"${opts.difficulty}"}

${grounded ? 'TEXT TO USE' : 'COURSE AND TOPIC'}:
${text}`
  }

  // ─── Response parser ──────────────────────────────────────────────────────

  private parseJsonObject<T>(raw: string): T {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()
    try {
      return JSON.parse(cleaned) as T
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('AI response did not contain a valid JSON object')
      return JSON.parse(match[0]) as T
    }
  }

  private parseJsonArray<T>(raw: string): T[] {
    // Strip markdown code fences if the model wrapped the output
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to extract a JSON array if there's surrounding text
      const match = cleaned.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('AI response did not contain a valid JSON array')
      parsed = JSON.parse(match[0])
    }

    if (!Array.isArray(parsed)) {
      throw new Error('AI response was not a JSON array')
    }

    return parsed as T[]
  }
}
