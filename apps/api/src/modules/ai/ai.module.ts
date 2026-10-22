import { Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { AiQuotaService } from './ai-quota.service'
import { LLM_PROVIDER } from './providers/llm-provider'
import { OpenAiProvider } from './providers/openai.provider'

@Module({
  // To change AI provider, bind LLM_PROVIDER to another LlmProvider implementation
  providers: [AiService, AiQuotaService, { provide: LLM_PROVIDER, useClass: OpenAiProvider }],
  exports: [AiService, AiQuotaService],
})
export class AiModule {}
