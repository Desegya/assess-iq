import { Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { LLM_PROVIDER } from './providers/llm-provider'
import { OpenAiProvider } from './providers/openai.provider'

@Module({
  // To change AI provider, bind LLM_PROVIDER to another LlmProvider implementation
  providers: [AiService, { provide: LLM_PROVIDER, useClass: OpenAiProvider }],
  exports: [AiService],
})
export class AiModule {}
