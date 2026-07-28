import type { ChatAgentProvider, ChatAgentRuntimeInput, ChatAgentRuntimeResult, ChatAiUsageComponent } from './chat'
import { chatbotAiSettingsToRuntime, normalizeChatbotAiSettings } from '@/lib/chatbot/ai-settings'

type TaliaAiChatResponse = {
  ok?: unknown
  reply?: unknown
  provider?: unknown
  model?: unknown
  usage?: unknown
  usage_components?: unknown
  usage_summary?: unknown
  sources?: unknown
  actions?: unknown
  metadata?: unknown
  error?: unknown
  details?: unknown
}

export class TaliaAiChatAgentProvider implements ChatAgentProvider {
  readonly name = 'talia-ai' as const

  async respond(input: ChatAgentRuntimeInput): Promise<ChatAgentRuntimeResult> {
    const baseUrl = process.env.TALIA_AI_BASE_URL?.replace(/\/$/, '')
    const apiKey = process.env.TALIA_AI_INTERNAL_API_KEY
    const includeFallbackContacts = !input.relevantKnowledge?.some((item) => item.score >= 4)
    const aiSettings = normalizeChatbotAiSettings(input.tenant.aiSettings)

    if (!baseUrl || !apiKey) {
      return {
        ok: false,
        provider: this.name,
        status: 503,
        error: 'TALIA AI service is not configured',
      }
    }

    try {
      const response = await fetch(`${baseUrl}/v1/chat/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: input.tenantId,
          session_id: input.sessionId,
          message: input.message,
          ...(input.pageUrl ? { page_url: input.pageUrl } : {}),
          ...(input.conversationContext?.length
            ? {
              conversation_context: input.conversationContext.map((message) => ({
                role: message.role,
                content: message.content,
              })),
            }
            : {}),
          ...(input.pendingClarification
            ? {
              pending_clarification: {
                intent: input.pendingClarification.intent,
                ...(input.pendingClarification.reason ? { reason: input.pendingClarification.reason } : {}),
                options: input.pendingClarification.options,
                ...(input.pendingClarification.optionKeys ? { option_keys: input.pendingClarification.optionKeys } : {}),
              },
            }
            : {}),
          fallback_language: input.tenant.fallbackLanguage,
          // Remove after every deployed talia-ai instance accepts fallback_language.
          language: input.tenant.fallbackLanguage,
          tenant: {
            name: input.tenant.name,
            system_prompt: input.tenant.systemPrompt ?? '',
            response_tone: input.tenant.responseTone,
            ai_settings: chatbotAiSettingsToRuntime(aiSettings),
            fallback: {
              ...(aiSettings.fallbackMessage ? { custom_message: aiSettings.fallbackMessage } : {}),
              whatsapp_enabled: aiSettings.fallbackWhatsApp,
            },
            ...(aiSettings.fallbackContacts && includeFallbackContacts && input.tenant.fallbackEmail ? { fallback_email: input.tenant.fallbackEmail } : {}),
            ...(aiSettings.fallbackContacts && includeFallbackContacts && input.tenant.fallbackPhone ? { fallback_phone: input.tenant.fallbackPhone } : {}),
          },
          relevant_knowledge: input.relevantKnowledge?.map((item) => ({
            id: item.id,
            source_id: item.sourceId,
            source_type: item.sourceType,
            question: item.question,
            answer: item.answer,
            category: item.category,
            priority: item.priority,
            score: normalizeKnowledgeScore(item.score),
          })) ?? [],
        }),
      })

      const text = await response.text()
      const body = parseTaliaAiResponse(text)

      if (!response.ok) {
        return {
          ok: false,
          provider: this.name,
          status: response.status,
          error: getErrorMessage(body) ?? `talia-ai responded with ${response.status}`,
          details: getDetails(body) ?? text,
        }
      }

      if (body?.ok === false) {
        return {
          ok: false,
          provider: this.name,
          status: 502,
          error: getErrorMessage(body) ?? 'talia-ai returned an error',
          details: getDetails(body),
        }
      }

      if (typeof body?.reply !== 'string' || !body.reply.trim()) {
        return {
          ok: false,
          provider: this.name,
          status: 502,
          error: 'talia-ai response did not include a reply',
          details: text,
        }
      }

      if (!getResponseLanguage(body.metadata)) {
        return {
          ok: false,
          provider: this.name,
          status: 502,
          error: 'talia-ai response did not include metadata.response_language',
          details: text,
        }
      }

      return {
        ok: true,
        provider: this.name,
        reply: body.reply,
        raw: text,
        model: typeof body.model === 'string' ? body.model : undefined,
        usage: isRecord(body.usage) ? body.usage : undefined,
        usageComponents: parseUsageComponents(body.usage_components),
        usageSummary: parseUsageSummary(body.usage_summary),
        sources: Array.isArray(body.sources) ? body.sources : undefined,
        actions: Array.isArray(body.actions) ? body.actions : undefined,
        metadata: isRecord(body.metadata) ? body.metadata : undefined,
      }
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        status: 502,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

function parseUsageComponents(value: unknown): ChatAiUsageComponent[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const component = item.component
    const provider = item.provider
    const model = item.model
    if (
      component !== 'answer_agent'
      && component !== 'language_agent'
      && component !== 'retrieval_embedding'
    ) return []
    if (typeof provider !== 'string' || !provider.trim() || typeof model !== 'string' || !model.trim()) return []

    return [{
      component,
      provider: provider.trim(),
      model: model.trim(),
      request_count: toNonNegativeInteger(item.request_count),
      input_tokens: toNonNegativeInteger(item.input_tokens),
      cached_input_tokens: Math.min(
        toNonNegativeInteger(item.input_tokens),
        toNonNegativeInteger(item.cached_input_tokens),
      ),
      output_tokens: toNonNegativeInteger(item.output_tokens),
    }]
  })
}

function parseUsageSummary(value: unknown) {
  if (!isRecord(value)) return undefined
  return {
    request_count: toNonNegativeInteger(value.request_count),
    input_tokens: toNonNegativeInteger(value.input_tokens),
    cached_input_tokens: toNonNegativeInteger(value.cached_input_tokens),
    output_tokens: toNonNegativeInteger(value.output_tokens),
  }
}

function toNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0
}

function parseTaliaAiResponse(text: string): TaliaAiChatResponse | null {
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function getErrorMessage(body: TaliaAiChatResponse | null) {
  return typeof body?.error === 'string' ? body.error : null
}

function getDetails(body: TaliaAiChatResponse | null) {
  return typeof body?.details === 'string' ? body.details : undefined
}

function getResponseLanguage(metadata: unknown) {
  if (!isRecord(metadata)) return null
  const responseLanguage = metadata.response_language
  return typeof responseLanguage === 'string' && responseLanguage.trim()
    ? responseLanguage.trim()
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeKnowledgeScore(score: number) {
  if (!Number.isFinite(score)) return 0
  if (score <= 1) return Math.max(0, score)
  return Math.max(0, Math.min(1, score / 20))
}
