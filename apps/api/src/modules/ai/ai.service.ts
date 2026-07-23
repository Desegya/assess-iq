import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
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

interface GenerateOptions {
  count: number
  types: QuestionType[]
  difficulty: QuestionDifficulty
  topicHint?: string
  userId: string
  organizationId?: string
  documentId: string
}

// Approximate cost per million tokens (USD) — Claude Sonnet 4.6
const COST_PER_M_INPUT = 3.0
const COST_PER_M_OUTPUT = 15.0

const MODEL = 'claude-sonnet-4-6'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly client: Anthropic

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '')
    this.client = new Anthropic({ apiKey: apiKey || 'placeholder' })
  }

  // ─── Generate questions from extracted document text ──────────────────────

  async generateQuestions(
    extractedText: string,
    opts: GenerateOptions,
  ): Promise<RawGeneratedQuestion[]> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '')
    if (!apiKey) {
      throw new BadRequestException(
        'ANTHROPIC_API_KEY is not configured. Add it to apps/api/.env to use AI generation.',
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
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })

      inputTokens = response.usage.input_tokens
      outputTokens = response.usage.output_tokens

      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      const questions = this.parseResponse(textBlock.text)
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

  private parseResponse(raw: string): RawGeneratedQuestion[] {
    // Strip markdown code fences if Claude wrapped the output
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
      if (!match) throw new Error('Claude response did not contain a valid JSON array')
      parsed = JSON.parse(match[0])
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Claude response was not a JSON array')
    }

    return parsed as RawGeneratedQuestion[]
  }
}
