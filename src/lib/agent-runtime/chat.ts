import type { ChatConversationContextMessage } from '@/lib/chat/conversation-context'
import type { ChatConversationResolution } from '@/lib/chat/conversation-resolution'
import type { ChatbotAiSettings } from '@/lib/chatbot/ai-settings'
import type { ChatbotResponseTone } from '@/lib/tenants/service'
import { TaliaAiChatAgentProvider } from './talia-ai'

export type ChatAgentProviderName = 'talia-ai'

export type ChatAgentRuntimeInput = {
  tenantId: string
  sessionId: string
  message: string
  timeZone: string
  pageUrl?: string
  conversationContext?: ChatConversationContextMessage[]
  pendingClarification?: ChatAgentPendingClarification
  previousResolution?: ChatConversationResolution
  tenant: {
    name: string
    fallbackLanguage: string
    responseTone: ChatbotResponseTone
    systemPrompt: string | null
    fallbackEmail: string | null
    fallbackPhone: string | null
    websiteUrl: string | null
    aiSettings?: ChatbotAiSettings
  }
}

export type ChatAgentPendingClarification = {
  intent: 'pricing' | 'schedule' | 'program'
  reason?: string
  options: string[]
  optionKeys?: string[]
}

export type ChatAiUsageComponent = {
  component: 'answer_agent' | 'diagnostic_agent' | 'grounding_review_agent' | 'language_agent' | 'official_web_search' | 'retrieval_embedding' | 'speech_to_text' | 'text_to_speech'
  provider: string
  model: string
  request_count: number
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
  tool_calls?: number
}

export type ChatAgentRuntimeResult =
  | {
    ok: true
    provider: ChatAgentProviderName
    reply: string
    raw?: string
    model?: string
    usage?: Record<string, unknown>
    usageComponents?: ChatAiUsageComponent[]
    usageSummary?: Record<string, number>
    sources?: unknown[]
    actions?: unknown[]
    metadata?: Record<string, unknown>
  }
  | {
    ok: false
    provider: ChatAgentProviderName
    status: number
    error: string
    details?: string
  }

export interface ChatAgentProvider {
  readonly name: ChatAgentRuntimeResult['provider']
  respond(input: ChatAgentRuntimeInput): Promise<ChatAgentRuntimeResult>
}

export function createChatAgentProvider(): ChatAgentProvider {
  return new TaliaAiChatAgentProvider()
}

export async function runChatAgent(input: ChatAgentRuntimeInput) {
  return createChatAgentProvider().respond(input)
}
