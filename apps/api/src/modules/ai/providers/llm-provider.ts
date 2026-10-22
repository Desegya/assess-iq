// Provider-neutral contract for the AI engine (docs/nightklass/01-product-vision.md §11): AiService builds
// prompts and logs usage; a provider only turns requests into model calls. Swap providers via LLM_PROVIDER.

export type LlmContentPart = { type: 'text'; text: string } | { type: 'image'; mimeType: string; data: Buffer }

export interface LlmMessage {
  role: 'user' | 'assistant'
  content: string | LlmContentPart[]
}

export interface LlmCompletionRequest {
  input: string | LlmMessage[]
  instructions?: string
  maxOutputTokens: number
  // When set, the provider must return JSON matching this JSON Schema (all properties required, no extras)
  jsonSchema?: { name: string; schema: Record<string, unknown> }
}

export interface LlmCompletion {
  text: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface LlmEmbedding {
  vectors: number[][]
  model: string
  inputTokens: number
  costUsd: number
}

export interface LlmProvider {
  readonly name: string
  isConfigured(): boolean
  /** Upper-bound USD cost used to reserve quota before a call; measured usage replaces it afterwards. */
  estimateCostUsd(inputTokens: number, maxOutputTokens: number, embedding?: boolean): number
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>
  embed(texts: string[]): Promise<LlmEmbedding>
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER')
