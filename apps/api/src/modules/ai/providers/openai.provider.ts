import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { LlmCompletion, LlmCompletionRequest, LlmEmbedding, LlmMessage, LlmProvider } from './llm-provider'

// USD per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
}

function cost(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICING[model]
  return p ? (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output : 0
}

function toOpenAiInput(input: string | LlmMessage[]): string | OpenAI.Responses.ResponseInput {
  if (typeof input === 'string') return input
  return input.map(m => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content }
    return {
      role: 'user' as const,
      content: m.content.map(part =>
        part.type === 'text'
          ? { type: 'input_text' as const, text: part.text }
          : {
              type: 'input_image' as const,
              image_url: `data:${part.mimeType};base64,${part.data.toString('base64')}`,
              detail: 'high' as const,
            },
      ),
    }
  })
}

@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai'
  private readonly client: OpenAI
  private readonly apiKey: string
  private readonly model: string
  private readonly embeddingModel: string

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY', '')
    this.model = config.get<string>('OPENAI_MODEL', 'gpt-5.4-mini')
    this.embeddingModel = config.get<string>('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')
    this.client = new OpenAI({ apiKey: this.apiKey || 'placeholder' })
  }

  isConfigured() {
    return !!this.apiKey
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const response = await this.client.responses.create({
      model: this.model,
      max_output_tokens: request.maxOutputTokens,
      ...(request.instructions && { instructions: request.instructions }),
      ...(request.jsonSchema && {
        text: {
          format: { type: 'json_schema', name: request.jsonSchema.name, schema: request.jsonSchema.schema, strict: true },
        },
      }),
      input: toOpenAiInput(request.input),
    })
    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0
    if (!response.output_text) {
      const error = new Error('Empty response from OpenAI') as Error & { usage?: object }
      error.usage = { inputTokens, outputTokens }
      throw error
    }
    return {
      text: response.output_text.trim(),
      model: this.model,
      inputTokens,
      outputTokens,
      costUsd: cost(this.model, inputTokens, outputTokens),
    }
  }

  async embed(texts: string[]): Promise<LlmEmbedding> {
    const response = await this.client.embeddings.create({ model: this.embeddingModel, input: texts })
    const inputTokens = response.usage?.prompt_tokens ?? 0
    return {
      vectors: response.data.sort((a, b) => a.index - b.index).map(d => d.embedding),
      model: this.embeddingModel,
      inputTokens,
      costUsd: cost(this.embeddingModel, inputTokens, 0),
    }
  }
}
