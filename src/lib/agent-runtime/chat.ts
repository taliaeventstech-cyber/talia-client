import { sendChatMessageToN8n } from '@/lib/chat/n8n'
import type { ChatbotAiSettings } from '@/lib/chatbot/ai-settings'
import type { RelevantKnowledgeHint } from '@/lib/knowledge/retrieval'
import type { ChatbotResponseTone } from '@/lib/tenants/service'
import { TaliaAiChatAgentProvider } from './talia-ai'

export type ChatAgentProviderName = 'n8n' | 'talia-ai'

export type ChatAgentRuntimeInput = {
  tenantId: string
  sessionId: string
  message: string
  pageUrl?: string
  pendingClarification?: ChatAgentPendingClarification
  n8nWebhookUrl: string | null
  tenant: {
    name: string
    fallbackLanguage: string
    responseTone: ChatbotResponseTone
    systemPrompt: string | null
    fallbackEmail: string | null
    fallbackPhone: string | null
    aiSettings?: ChatbotAiSettings
  }
  relevantKnowledge?: RelevantKnowledgeHint[]
}

export type ChatAgentPendingClarification = {
  intent: 'pricing' | 'schedule' | 'program'
  reason?: string
  options: string[]
  optionKeys?: string[]
}

export type ChatAiUsageComponent = {
  component: 'answer_agent' | 'language_agent' | 'retrieval_embedding'
  provider: string
  model: string
  request_count: number
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
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

export class N8nChatAgentProvider implements ChatAgentProvider {
  readonly name = 'n8n' as const

  async respond(input: ChatAgentRuntimeInput): Promise<ChatAgentRuntimeResult> {
    if (!input.n8nWebhookUrl) {
      return {
        ok: false,
        provider: this.name,
        status: 503,
        error: 'Chat is not configured for this tenant',
      }
    }

    const response = await sendChatMessageToN8n({
      webhookUrl: input.n8nWebhookUrl,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      message: input.message,
      relevantKnowledge: input.relevantKnowledge,
    })

    if (!response.ok) {
      return {
        ok: false,
        provider: this.name,
        status: 502,
        error: response.error,
        details: response.details,
      }
    }

    return {
      ok: true,
      provider: this.name,
      reply: response.reply,
      raw: response.raw,
    }
  }
}

export function createChatAgentProvider(): ChatAgentProvider {
  if (isTaliaAiPrimaryProvider()) {
    return new FallbackChatAgentProvider(
      new TaliaAiChatAgentProvider(),
      new N8nChatAgentProvider(),
    )
  }

  return new N8nChatAgentProvider()
}

export async function runChatAgent(input: ChatAgentRuntimeInput) {
  return createChatAgentProvider().respond(input)
}

export function isTaliaAiPrimaryProvider() {
  return process.env.CHAT_AGENT_PROVIDER === 'talia-ai'
}

class FallbackChatAgentProvider implements ChatAgentProvider {
  readonly name: ChatAgentProviderName

  constructor(
    private readonly primary: ChatAgentProvider,
    private readonly fallback: ChatAgentProvider,
  ) {
    this.name = primary.name
  }

  async respond(input: ChatAgentRuntimeInput): Promise<ChatAgentRuntimeResult> {
    const result = await this.primary.respond(input)
    if (result.ok || !shouldFallback(result) || !input.n8nWebhookUrl) return result

    console.warn('[chat-agent-runtime] primary provider failed, falling back', {
      primary: result.provider,
      fallback: this.fallback.name,
      status: result.status,
      error: result.error,
      tenantId: input.tenantId,
    })

    return this.fallback.respond(input)
  }
}

function shouldFallback(result: Extract<ChatAgentRuntimeResult, { ok: false }>) {
  return result.provider === 'talia-ai' && result.status >= 500
}
