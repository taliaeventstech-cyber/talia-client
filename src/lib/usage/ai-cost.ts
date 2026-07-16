import type { ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json, Tables } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>
type AiPricing = Tables<'ai_model_pricing'>

export type AiCostAccuracy = 'measured' | 'estimated_legacy' | 'reconciled'

export function calculateAiCostUsdMicros(component: ChatAiUsageComponent, pricing: AiPricing) {
  const cachedInputTokens = Math.min(component.input_tokens, component.cached_input_tokens)
  const uncachedInputTokens = component.input_tokens - cachedInputTokens

  return (
    uncachedInputTokens * pricing.input_usd_micros_per_million
    + cachedInputTokens * pricing.cached_input_usd_micros_per_million
    + component.output_tokens * pricing.output_usd_micros_per_million
  ) / 1_000_000
}

export async function recordMeasuredAiUsage(
  admin: AdminClient,
  input: {
    tenantId: string
    sessionId: string
    usageEventId: string
    idempotencyPrefix: string
    components: ChatAiUsageComponent[]
    occurredAt?: Date
    metadata?: Json
  },
) {
  const occurredAt = input.occurredAt ?? new Date()
  const occurredAtIso = occurredAt.toISOString()
  const pricingCache = new Map<string, AiPricing | null>()
  const rows = []

  for (const [index, component] of input.components.entries()) {
    const pricingKey = `${component.provider}:${component.model}`
    let pricing = pricingCache.get(pricingKey)

    if (pricing === undefined) {
      pricing = await findPricing(admin, component.provider, component.model, occurredAtIso)
      pricingCache.set(pricingKey, pricing)
    }

    rows.push({
      theatre_id: input.tenantId,
      usage_event_id: input.usageEventId,
      pricing_id: pricing?.id ?? null,
      session_id: input.sessionId,
      component: component.component,
      provider: component.provider,
      model: component.model,
      request_count: component.request_count,
      input_tokens: component.input_tokens,
      cached_input_tokens: component.cached_input_tokens,
      output_tokens: component.output_tokens,
      cost_usd_micros: pricing ? calculateAiCostUsdMicros(component, pricing) : 0,
      accuracy: 'measured' satisfies AiCostAccuracy,
      idempotency_key: `${input.idempotencyPrefix}:${index}:${component.component}`,
      metadata: {
        ...(isJsonObject(input.metadata) ? input.metadata : {}),
        pricing_status: pricing ? 'priced' : 'missing',
      },
      occurred_at: occurredAtIso,
    })
  }

  if (!rows.length) return { ok: true as const, inserted: 0 }

  const { error } = await admin
    .from('ai_usage_events')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true })

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, inserted: rows.length }
}

async function findPricing(
  admin: AdminClient,
  provider: string,
  model: string,
  occurredAtIso: string,
): Promise<AiPricing | null> {
  const { data, error } = await admin
    .from('ai_model_pricing')
    .select('*')
    .eq('provider', provider)
    .eq('model', model)
    .lte('effective_from', occurredAtIso)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  if (data.effective_to && data.effective_to <= occurredAtIso) return null
  return data
}

function isJsonObject(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
