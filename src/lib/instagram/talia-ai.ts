import type { ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import type { ChannelAgentPolicy } from '@/lib/attention/channel-agent'
import { z } from 'zod'

const usageComponentSchema = z.object({
  component: z.enum(['answer_agent', 'grounding_review_agent', 'language_agent', 'retrieval_embedding']),
  provider: z.string().min(1),
  model: z.string().min(1),
  request_count: z.number().int().min(0),
  input_tokens: z.number().int().min(0),
  cached_input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
})

const instagramAgentResponseSchema = z.object({
  ok: z.literal(true),
  action: z.enum(['respond', 'handoff']),
  reply: z.string().trim().min(1).max(1_000).nullable(),
  provider: z.string().min(1),
  model: z.string().min(1),
  usage_components: z.array(usageComponentSchema).default([]),
  usage_summary: z.object({
    request_count: z.number().int().min(0),
    input_tokens: z.number().int().min(0),
    cached_input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
  }),
  sources: z.array(z.object({
    id: z.string().min(1),
    source_id: z.string().nullable(),
    source_type: z.string().min(1),
    score: z.number(),
  })).default([]),
  metadata: z.record(z.string(), z.unknown()),
}).superRefine((value, context) => {
  if (value.action === 'respond' && !value.reply) {
    context.addIssue({ code: 'custom', message: 'An Instagram response action requires reply text' })
  }
  if (value.action === 'handoff' && value.reply) {
    context.addIssue({ code: 'custom', message: 'An Instagram handoff must not include sendable reply text' })
  }
})

export type InstagramAgentResult = z.infer<typeof instagramAgentResponseSchema> & {
  usage_components: ChatAiUsageComponent[]
}

export type InstagramAgentRequest = {
  tenantId: string
  connectionId: string
  conversationId: string
  messageId: string
  message: string
  fallbackLanguage: string
  conversationContext: Array<{ role: 'user' | 'assistant'; content: string }>
  previousResolution?: Record<string, unknown>
  tenant: {
    name: string
    fallbackEmail: string | null
    fallbackPhone: string | null
  }
  policy: ChannelAgentPolicy
  fallbackMessage?: string | null
  aiSettings?: {
    temperature?: number
    groundingMode?: 'strict' | 'balanced'
    minContextScore?: number
    maxContextItems?: number
  }
}

export type InstagramAgentClientResult =
  | { ok: true; result: InstagramAgentResult }
  | { ok: false; retryable: boolean; status: number; errorCode: string }

export async function requestInstagramAgent(
  input: InstagramAgentRequest,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<InstagramAgentClientResult> {
  const baseUrl = process.env.TALIA_AI_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.TALIA_AI_INTERNAL_API_KEY
  if (!baseUrl || !apiKey) {
    return { ok: false, retryable: false, status: 503, errorCode: 'talia_ai_not_configured' }
  }

  const fetcher = options.fetcher ?? fetch
  try {
    const response = await fetcher(`${baseUrl}/v1/instagram/respond`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: input.tenantId,
        connection_id: input.connectionId,
        conversation_id: input.conversationId,
        message_id: input.messageId,
        message: input.message,
        fallback_language: input.fallbackLanguage,
        conversation_context: input.conversationContext,
        ...(input.previousResolution ? { previous_resolution: input.previousResolution } : {}),
        tenant: {
          name: input.tenant.name,
          fallback_email: input.tenant.fallbackEmail,
          fallback_phone: input.tenant.fallbackPhone,
          agent_settings: {
            tone: normalizeTone(input.policy.tone),
            channel_prompt: input.policy.channelPrompt,
            fallback_mode: input.policy.fallbackMode,
            fallback_message: input.fallbackMessage ?? null,
            temperature: input.aiSettings?.temperature ?? 0.2,
            grounding_mode: input.aiSettings?.groundingMode ?? 'strict',
            min_context_score: input.aiSettings?.minContextScore ?? 0.3,
            max_context_items: input.aiSettings?.maxContextItems ?? 5,
            permitted_actions: input.policy.permittedActions,
          },
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    })

    if (!response.ok) {
      return {
        ok: false,
        retryable: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500,
        status: response.status,
        errorCode: `talia_ai_http_${response.status}`,
      }
    }

    const parsed = instagramAgentResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      return { ok: false, retryable: true, status: 502, errorCode: 'talia_ai_invalid_response' }
    }
    return { ok: true, result: parsed.data as InstagramAgentResult }
  } catch {
    return { ok: false, retryable: true, status: 502, errorCode: 'talia_ai_network_error' }
  }
}

function normalizeTone(tone: string | null) {
  if (tone === 'formal' || tone === 'brief' || tone === 'close') return tone
  return 'close' as const
}
