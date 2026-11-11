'use server'

import type { ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import { consumeRateLimit } from '@/lib/auth/security'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getResponseSourcesByMessageId, type ResponseSource } from '@/lib/conversations/response-sources'
import { runWebAgentTestTurn, testChatRequestSchema } from '@/lib/chat/test-chat'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { recordUsageEvent } from '@/lib/usage/service'
import type { Json } from '@/types/database.types'

export type TestWebAgentResult =
  | { ok: true; reply: string; sources: ResponseSource[]; additionalSources: number; state: Json | null }
  | { ok: false; error: 'forbidden' | 'invalid' | 'rate_limited' | 'unavailable' }

/**
 * Agora test chat: answers with the venue's current Knowledge and saved
 * instructions, exactly like the public widget, but nothing is saved as a
 * conversation, shown in analytics or counted as a billable message. Only the
 * AI cost is recorded (as an internal `ai_call`).
 */
export async function testWebAgentMessage(tenantId: string, rawInput: unknown): Promise<TestWebAgentResult> {
  await requireTenantProductAccess(tenantId, 'manage_chatbot', 'web')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'forbidden' }

  const parsed = testChatRequestSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const limited = await consumeRateLimit([{
    key: `agora-test-chat:${tenantId}:${user.id}`,
    limit: 30,
    windowMs: 10 * 60_000,
  }])
  if (limited) return { ok: false, error: limited.unavailable ? 'unavailable' : 'rate_limited' }

  const admin = createAdminClient()
  // The test chat also works while the public widget is still switched off.
  const tenant = await getTenantChatConfig(admin, tenantId, { allowDisabled: true })
  if (!tenant.ok) return { ok: false, error: 'unavailable' }

  const sessionId = `agora-test:${user.id}`
  const turn = await runWebAgentTestTurn({ tenantId, sessionId, config: tenant.config, request: parsed.data })
  if (!turn.ok) {
    console.warn('[test-chat] agent failed', { tenantId, error: turn.error })
    return { ok: false, error: 'unavailable' }
  }

  await recordTestChatCost(admin, { tenantId, sessionId, components: turn.usageComponents, model: turn.model })

  // Same human-readable source names as Agora's conversation details.
  const resolved = await getResponseSourcesByMessageId(admin, {
    tenantId,
    messages: [{ id: 'test', metadata: { agent_sources: turn.sources } }],
  })
  const sources = resolved.get('test')

  return {
    ok: true,
    reply: turn.reply,
    sources: sources?.sources ?? [],
    additionalSources: sources?.additionalCount ?? 0,
    state: turn.state,
  }
}

async function recordTestChatCost(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    tenantId: string
    sessionId: string
    components: ChatAiUsageComponent[]
    model: string | null
  },
) {
  if (!input.components.length) return
  const correlationId = crypto.randomUUID()
  const totals = input.components.reduce((sum, component) => ({
    requestCount: sum.requestCount + component.request_count,
    inputTokens: sum.inputTokens + component.input_tokens,
    outputTokens: sum.outputTokens + component.output_tokens,
  }), { requestCount: 0, inputTokens: 0, outputTokens: 0 })

  // An `ai_call`, never a `message`: test turns do not count toward the plan.
  const aiCall = await recordUsageEvent(admin, {
    tenantId: input.tenantId,
    moduleKey: 'web',
    channel: 'web',
    eventType: 'ai_call',
    unit: 'call',
    quantity: totals.requestCount,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    idempotencyKey: `agora-test-chat:${input.tenantId}:${correlationId}:ai_call`,
    metadata: { session_id: input.sessionId, accuracy: 'measured', source: 'agora_test_chat', model: input.model },
  })
  if (!aiCall.ok || !aiCall.eventId) return

  await recordMeasuredAiUsage(admin, {
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    usageEventId: aiCall.eventId,
    idempotencyPrefix: `agora-test-chat:${input.tenantId}:${correlationId}:component`,
    components: input.components,
    metadata: { source: 'agora_test_chat' },
  })
}
