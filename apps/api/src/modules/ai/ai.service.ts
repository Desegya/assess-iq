import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { PrismaService } from '../prisma/prisma.service'
import { QuestionDifficulty, QuestionType } from '@assessiq/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawGeneratedQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  questionText: string
  options?: { key: string; text: string }[]
  correctAnswer: string
  explanation?: string
}

export interface RawExtractedTopic {
  name: string
  description?: string
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
}

interface ChatOptions {
  userId: string
  organizationId?: string
  relatedEntityId: string
}

// Price per million tokens (USD) — gpt-5.4-mini
const COST_PER_M_INPUT = 0.75
const COST_PER_M_OUTPUT = 4.5

const MODEL = 'gpt-5.4-mini'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly client: OpenAI

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '')
    this.client = new OpenAI({ apiKey: apiKey || 'placeholder' })
  }

  // ─── Generate questions from extracted document text ──────────────────────

  async generateQuestions(
    extractedText: string,
    opts: GenerateOptions,
  ): Promise<RawGeneratedQuestion[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '')
    if (!apiKey) {
      throw new BadRequestException(
        'OPENAI_API_KEY is not configured. Add it to apps/api/.env to use AI generation.',
      )
    }

    // Take a representative slice of the text (avoid hitting token limits)
    const textSlice = extractedText.slice(0, 12000)
    const prompt = this.buildPrompt(textSlice, opts)

    const start = Date.now()
    let inputTokens = 0
    let outputTokens = 0
    let success = true
    let errorMessage: string | undefined

    try {
      const response = await this.client.responses.create({
        model: MODEL,
        max_output_tokens: 4096,
        input: prompt,
      })

      inputTokens = response.usage?.input_tokens ?? 0
      outputTokens = response.usage?.output_tokens ?? 0

      if (!response.output_text) {
        throw new Error('Empty response from OpenAI')
      }

      const questions = this.parseJsonArray<RawGeneratedQuestion>(response.output_text)
      this.logger.log(
        `Generated ${questions.length} questions for doc ${opts.documentId} ` +
          `(${inputTokens} in / ${outputTokens} out tokens)`,
      )
      return questions
    } catch (err) {
      success = false
      errorMessage = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      // Always log AI usage
      const durationMs = Date.now() - start
      const costUsd =
        (inputTokens / 1_000_000) * COST_PER_M_INPUT +
        (outputTokens / 1_000_000) * COST_PER_M_OUTPUT

      await this.prisma.aIUsageLog
        .create({
          data: {
            organizationId: opts.organizationId,
            userId: opts.userId,
            action: 'GENERATE_QUESTIONS',
            model: MODEL,
            inputTokens,
            outputTokens,
            costUsd,
            durationMs,
            success,
            errorMessage,
            relatedEntityId: opts.documentId,
          },
        })
        .catch(e => this.logger.error('Failed to save AI usage log', e))
    }
  }

  // ─── Extract candidate topics from extracted document text ────────────────

  async extractTopics(
    extractedText: string,
    opts: ExtractTopicsOptions,
  ): Promise<RawExtractedTopic[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '')
    if (!apiKey) {
      throw new BadRequestException(
        'OPENAI_API_KEY is not configured. Add it to apps/api/.env to use AI generation.',
      )
    }

    const textSlice = extractedText.slice(0, 12000)
    const prompt = `You are an expert curriculum designer. Read the course material below and break it
into a short, ordered list of study topics a student could plan revision sessions around.

- Produce between 4 and 12 topics, in the order they appear in the text
- Each topic name should be concise (under 8 words)
- Include a one-sentence description of what the topic covers

Return ONLY a valid JSON array — no markdown, no explanation, just the array.
Each item must match: {"name":"...","description":"..."}

TEXT TO USE:
${textSlice}`

    const start = Date.now()
    let inputTokens = 0
    let outputTokens = 0
    let success = true
    let errorMessage: string | undefined

    try {
      const response = await this.client.responses.create({
        model: MODEL,
        max_output_tokens: 2048,
        input: prompt,
      })

      inputTokens = response.usage?.input_tokens ?? 0
      outputTokens = response.usage?.output_tokens ?? 0

      if (!response.output_text) {
        throw new Error('Empty response from OpenAI')
      }

      const topics = this.parseJsonArray<RawExtractedTopic>(response.output_text)
      this.logger.log(`Extracted ${topics.length} topics for doc ${opts.documentId}`)
      return topics
    } catch (err) {
      success = false
      errorMessage = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      const durationMs = Date.now() - start
      const costUsd =
        (inputTokens / 1_000_000) * COST_PER_M_INPUT +
        (outputTokens / 1_000_000) * COST_PER_M_OUTPUT

      await this.prisma.aIUsageLog
        .create({
          data: {
            organizationId: opts.organizationId,
            userId: opts.userId,
            action: 'EXTRACT_TOPICS',
            model: MODEL,
            inputTokens,
            outputTokens,
            costUsd,
            durationMs,
            success,
            errorMessage,
            relatedEntityId: opts.documentId,
          },
        })
        .catch(e => this.logger.error('Failed to save AI usage log', e))
    }
  }

  // ─── Generate flashcards from extracted document text ─────────────────────

  async generateFlashcards(
    extractedText: string,
    opts: GenerateFlashcardsOptions,
  ): Promise<RawFlashcard[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '')
    if (!apiKey) {
      throw new BadRequestException(
        'OPENAI_API_KEY is not configured. Add it to apps/api/.env to use AI generation.',
      )
    }

    const textSlice = extractedText.slice(0, 12000)
    const prompt = `You are an expert tutor creating spaced-repetition flashcards from study material.

Generate exactly ${opts.count} flashcards from the text below${opts.topicHint ? ` focused on: ${opts.topicHint}` : ''}.
- Each card should test one clear fact, definition, or concept
- The front should be a short question or prompt; the back should be a concise, correct answer
- Avoid duplicating the same fact across cards

Return ONLY a valid JSON array — no markdown, no explanation, just the array.
Each item must match: {"front":"...","back":"..."}

TEXT TO USE:
${textSlice}`

    const start = Date.now()
    let inputTokens = 0
    let outputTokens = 0
    let success = true
    let errorMessage: string | undefined

    try {
      const response = await this.client.responses.create({
        model: MODEL,
        max_output_tokens: 2048,
        input: prompt,
      })

      inputTokens = response.usage?.input_tokens ?? 0
      outputTokens = response.usage?.output_tokens ?? 0

      if (!response.output_text) {
        throw new Error('Empty response from OpenAI')
      }

      const cards = this.parseJsonArray<RawFlashcard>(response.output_text)
      this.logger.log(`Generated ${cards.length} flashcards for doc ${opts.documentId}`)
      return cards
    } catch (err) {
      success = false
      errorMessage = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      const durationMs = Date.now() - start
      const costUsd =
        (inputTokens / 1_000_000) * COST_PER_M_INPUT +
        (outputTokens / 1_000_000) * COST_PER_M_OUTPUT

      await this.prisma.aIUsageLog
        .create({
          data: {
            organizationId: opts.organizationId,
            userId: opts.userId,
            action: 'GENERATE_FLASHCARDS',
            model: MODEL,
            inputTokens,
            outputTokens,
            costUsd,
            durationMs,
            success,
            errorMessage,
            relatedEntityId: opts.documentId,
          },
        })
        .catch(e => this.logger.error('Failed to save AI usage log', e))
    }
  }

  // ─── Study chat — answer a question grounded in course material ───────────

  async chat(messages: ChatMessage[], systemContext: string, opts: ChatOptions): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '')
    if (!apiKey) {
      throw new BadRequestException(
        'OPENAI_API_KEY is not configured. Add it to apps/api/.env to use AI generation.',
      )
    }

    const start = Date.now()
    let inputTokens = 0
    let outputTokens = 0
    let success = true
    let errorMessage: string | undefined

    try {
      const response = await this.client.responses.create({
        model: MODEL,
        max_output_tokens: 1024,
        instructions: systemContext,
        input: messages.map(m => ({ role: m.role, content: m.content })),
      })

      inputTokens = response.usage?.input_tokens ?? 0
      outputTokens = response.usage?.output_tokens ?? 0

      if (!response.output_text) {
        throw new Error('Empty response from OpenAI')
      }

      return response.output_text.trim()
    } catch (err) {
      success = false
      errorMessage = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      const durationMs = Date.now() - start
      const costUsd =
        (inputTokens / 1_000_000) * COST_PER_M_INPUT +
        (outputTokens / 1_000_000) * COST_PER_M_OUTPUT

      await this.prisma.aIUsageLog
        .create({
          data: {
            organizationId: opts.organizationId,
            userId: opts.userId,
            action: 'ANSWER_QUESTION',
            model: MODEL,
            inputTokens,
            outputTokens,
            costUsd,
            durationMs,
            success,
            errorMessage,
            relatedEntityId: opts.relatedEntityId,
          },
        })
        .catch(e => this.logger.error('Failed to save AI usage log', e))
    }
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
          return 'SHORT_ANSWER (brief written answer)'
        return t
      })
      .join(', ')

    return `You are an expert educator creating exam questions from educational content.

Generate exactly ${opts.count} exam questions from the text below.
- Difficulty: ${opts.difficulty}
- Question types to use: ${typeDescriptions}${opts.topicHint ? `\n- Focus on topic: ${opts.topicHint}` : ''}
- Distribute question types roughly evenly across the types listed
- Make questions clear, unambiguous, and directly based on the text
- For MCQ: always provide exactly 4 options (A, B, C, D)
- For TRUE_FALSE: options must be exactly [{"key":"A","text":"True"},{"key":"B","text":"False"}]

Return ONLY a valid JSON array — no markdown, no explanation, just the array.

Each item must match one of these schemas:

MCQ / TRUE_FALSE:
{"type":"MCQ","questionText":"...","options":[{"key":"A","text":"..."},...],"correctAnswer":"A","explanation":"...","difficulty":"${opts.difficulty}"}

SHORT_ANSWER:
{"type":"SHORT_ANSWER","questionText":"...","correctAnswer":"...","explanation":"...","difficulty":"${opts.difficulty}"}

TEXT TO USE:
${text}`
  }

  // ─── Response parser ──────────────────────────────────────────────────────

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
      if (!match) throw new Error('OpenAI response did not contain a valid JSON array')
      parsed = JSON.parse(match[0])
    }

    if (!Array.isArray(parsed)) {
      throw new Error('OpenAI response was not a JSON array')
    }

    return parsed as T[]
  }
}
