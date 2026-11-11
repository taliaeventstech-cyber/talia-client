import { z } from 'zod'
import { runChatAgent, type ChatAgentRuntimeInput, type ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import { boundConversationContext } from '@/lib/chat/conversation-context'
import { extractPreviousConversationResolution } from '@/lib/chat/conversation-resolution'
import {
  enforceAllowedContactEmails,
  extractPendingClarification,
  summarizeAgentSources,
  type AgentSourceSummary,
} from '@/lib/chat/agent-response'
import type { TenantChatConfig } from '@/lib/tenants/service'
import type { Json } from '@/types/database.types'

// Agora "test chat": lets a venue check how TALIA answers from its current
// Knowledge and instructions. It runs the same agent as the public widget but
// nothing is stored as a conversation, shown in analytics or billed as a
// message; only the AI cost is recorded internally by the caller.

const MAX_STATE_CHARACTERS = 4_000

export const testChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2_000),
  })).max(12).default([]),
  // Opaque follow-up state returned by the previous test turn.
  state: z.unknown().optional(),
  pageUrl: z.string().trim().max(2_048).optional(),
  timeZone: z.string().trim().max(64).optional(),
})

export type TestChatRequest = z.infer<typeof testChatRequestSchema>

export type TestChatTurn =
  | {
    ok: true
    reply: string
    sources: AgentSourceSummary[]
    state: Json | null
    usageComponents: ChatAiUsageComponent[]
    model: string | null
    provider: string
  }
  | { ok: false; error: string }

type AgentRunner = (input: ChatAgentRuntimeInput) => ReturnType<typeof runChatAgent>

/**
 * Keeps only what the next turn needs to continue a clarification or a
 * resolved topic. The server re-validates it on every turn, so a tampered
 * value can at most lose that context.
 */
export function buildTestChatState(metadata: Record<string, unknown> | undefined): Json | null {
  if (!metadata) return null
  const state: Record<string, unknown> = {}
  for (const key of ['action', 'clarification', 'resolution']) {
    if (metadata[key] !== undefined) state[key] = metadata[key]
  }
  if (!Object.keys(state).length) return null
  const serialized = JSON.stringify(state)
  return serialized.length <= MAX_STATE_CHARACTERS ? (JSON.parse(serialized) as Json) : null
}

export async function runWebAgentTestTurn(
  input: {
    tenantId: string
    sessionId: string
    config: TenantChatConfig
    request: TestChatRequest
  },
  runAgent: AgentRunner = runChatAgent,
): Promise<TestChatTurn> {
  const { config, request } = input
  const newestFirst = [...request.history].reverse()
  const state = request.state as Json | undefined

  const response = await runAgent({
    n8nWebhookUrl: config.n8nWebhookUrl,
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    message: request.message,
    timeZone: request.timeZone || 'Europe/Madrid',
    pageUrl: request.pageUrl,
    conversationContext: boundConversationContext(newestFirst),
    pendingClarification: extractPendingClarification(state),
    previousResolution: extractPreviousConversationResolution(state),
    tenant: {
      name: config.name,
      fallbackLanguage: config.language,
      responseTone: config.responseTone,
      systemPrompt: config.systemPrompt,
      fallbackEmail: config.fallbackEmail,
      fallbackPhone: config.fallbackPhone,
      websiteUrl: config.websiteUrl,
      aiSettings: config.aiSettings,
    },
    relevantKnowledge: [],
  })

  if (!response.ok) {
    return { ok: false, error: response.error ?? 'agent_unavailable' }
  }

  // Same contact guard as the public widget, so tests show the real answer.
  const contactGuard = enforceAllowedContactEmails(response.reply, {
    fallbackEmail: config.fallbackEmail,
    fallbackContacts: config.aiSettings.fallbackContacts,
  })

  return {
    ok: true,
    reply: contactGuard.reply,
    sources: summarizeAgentSources(response.sources),
    state: buildTestChatState(response.metadata),
    usageComponents: response.usageComponents ?? [],
    model: response.model ?? null,
    provider: response.provider,
  }
}
