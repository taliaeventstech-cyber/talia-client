import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json, Tables } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type UsageModuleKey = 'chatbot' | 'voice' | 'email' | 'whatsapp' | 'instagram' | 'data' | 'marketing'
export type UsageChannel = 'chatbot' | 'email' | 'voice' | 'instagram' | 'whatsapp' | 'backstage' | 'system'
export type UsageEventType =
  | 'conversation_started'
  | 'message'
  | 'ai_call'
  | 'tool_call'
  | 'voice_minute'
  | 'resolution'
  | 'fallback'
  | 'limit_exceeded'

export type UsageUnit = 'conversation' | 'message' | 'token' | 'minute' | 'call' | 'resolution' | 'event'

export type UsageTotals = {
  conversations: number
  messages: number
  aiCalls: number
  toolCalls: number
  inputTokens: number
  outputTokens: number
  voiceMinutes: number
  resolutions: number
  fallbacks: number
  limitExceededEvents: number
  estimatedCostCents: number
}

export type RecordUsageEventInput = {
  tenantId: string
  moduleKey: UsageModuleKey
  channel: UsageChannel
  eventType: UsageEventType
  quantity?: number
  unit: UsageUnit
  inputTokens?: number
  outputTokens?: number
  costEstimateCents?: number
  idempotencyKey?: string
  metadata?: Json
  occurredAt?: Date
}

export type LimitCheckInput = {
  tenantId: string
  channel: 'chatbot' | 'email' | 'voice'
  projectedQuantity?: number
}

const planDefaults = {
  essential: {
    includedChatConversations: 1000,
    includedEmailConversations: 0,
    includedVoiceMinutes: 0,
    overagePriceChatCents: 10,
    overagePriceEmailCents: 12,
    overagePriceVoiceMinuteCents: 35,
  },
  professional: {
    includedChatConversations: 4000,
    includedEmailConversations: 500,
    includedVoiceMinutes: 0,
    overagePriceChatCents: 8,
    overagePriceEmailCents: 10,
    overagePriceVoiceMinuteCents: 35,
  },
  enterprise: {
    includedChatConversations: 12000,
    includedEmailConversations: 2000,
    includedVoiceMinutes: 120,
    overagePriceChatCents: 6,
    overagePriceEmailCents: 8,
    overagePriceVoiceMinuteCents: 35,
  },
  custom: {
    includedChatConversations: 12000,
    includedEmailConversations: 2000,
    includedVoiceMinutes: 120,
    overagePriceChatCents: 6,
    overagePriceEmailCents: 8,
    overagePriceVoiceMinuteCents: 35,
  },
} as const

export function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

export function estimateOpenAiTextCostCents(inputTokens: number, outputTokens: number, model: 'gpt-4o-mini' | 'gpt-4o' = 'gpt-4o-mini') {
  const rates = model === 'gpt-4o'
    ? { inputPerMillionDollars: 2.5, outputPerMillionDollars: 10 }
    : { inputPerMillionDollars: 0.15, outputPerMillionDollars: 0.6 }

  const dollars =
    (inputTokens / 1_000_000) * rates.inputPerMillionDollars
    + (outputTokens / 1_000_000) * rates.outputPerMillionDollars

  return Math.ceil(dollars * 100)
}

export function getCurrentBillingPeriod(referenceDate = new Date()) {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1))
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1))

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  }
}

export async function getActiveSubscription(admin: AdminClient, tenantId: string, referenceDate = new Date()) {
  const date = toDateString(referenceDate)
  const { data: existing, error: existingError } = await admin
    .from('tenant_subscriptions')
    .select('*')
    .eq('theatre_id', tenantId)
    .lte('billing_period_start', date)
    .gt('billing_period_end', date)
    .order('billing_period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    return { ok: false as const, error: existingError.message }
  }

  if (existing) {
    return { ok: true as const, subscription: existing }
  }

  const { data: tenant, error: tenantError } = await admin
    .from('theatres')
    .select('plan')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError) {
    return { ok: false as const, error: tenantError.message }
  }

  const plan = normalizePlan(tenant?.plan)
  const defaults = planDefaults[plan]
  const period = getCurrentBillingPeriod(referenceDate)
  const { data: created, error: createError } = await admin
    .from('tenant_subscriptions')
    .insert({
      theatre_id: tenantId,
      plan,
      billing_period_start: period.startDate,
      billing_period_end: period.endDate,
      included_chat_conversations: defaults.includedChatConversations,
      included_email_conversations: defaults.includedEmailConversations,
      included_voice_minutes: defaults.includedVoiceMinutes,
      overage_price_chat_cents: defaults.overagePriceChatCents,
      overage_price_email_cents: defaults.overagePriceEmailCents,
      overage_price_voice_minute_cents: defaults.overagePriceVoiceMinuteCents,
      hard_limit_enabled: true,
      hard_limit_behavior: 'fallback',
    })
    .select('*')
    .single()

  if (createError || !created) {
    return { ok: false as const, error: createError?.message ?? 'Could not create subscription period' }
  }

  return { ok: true as const, subscription: created }
}

/**
 * Billable chatbot usage follows the Botsonic model: only assistant replies
 * generated by TALIA count against the plan limit. Visitor messages and
 * degraded fallback replies (no model call) do not consume quota.
 */
export async function getChatbotBillableMessagesForPeriod(
  admin: AdminClient,
  tenantId: string,
  period = getCurrentBillingPeriod(),
) {
  const { count, error } = await admin
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('theatre_id', tenantId)
    .eq('channel', 'chatbot')
    .eq('event_type', 'message')
    .eq('metadata->>role', 'assistant')
    .gte('occurred_at', period.startDate)
    .lt('occurred_at', period.endDate)

  if (error) {
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const, count: count ?? 0 }
}

export async function getTenantUsageForPeriod(
  admin: AdminClient,
  tenantId: string,
  period = getCurrentBillingPeriod(),
) {
  const { data, error } = await admin
    .from('tenant_usage_daily')
    .select('conversations,messages,ai_calls,tool_calls,input_tokens,output_tokens,voice_minutes,resolutions,fallbacks,limit_exceeded_events,estimated_cost_cents')
    .eq('theatre_id', tenantId)
    .gte('date', period.startDate)
    .lt('date', period.endDate)

  if (error) {
    return { ok: false as const, error: error.message }
  }

  return {
    ok: true as const,
    usage: sumUsageRows(data ?? []),
  }
}

export async function checkTenantLimit(admin: AdminClient, input: LimitCheckInput) {
  const subscriptionResult = await getActiveSubscription(admin, input.tenantId)
  if (!subscriptionResult.ok) return subscriptionResult

  const subscription = subscriptionResult.subscription
  const period = {
    startDate: subscription.billing_period_start,
    endDate: subscription.billing_period_end,
  }

  let current: number
  if (input.channel === 'chatbot') {
    const billableResult = await getChatbotBillableMessagesForPeriod(admin, input.tenantId, period)
    if (!billableResult.ok) return billableResult
    current = billableResult.count
  } else {
    const usageResult = await getTenantUsageForPeriod(admin, input.tenantId, period)
    if (!usageResult.ok) return usageResult
    current = getUsageForChannel(usageResult.usage, input.channel)
  }

  const projectedQuantity = input.projectedQuantity ?? 1
  const limit = getLimitForChannel(subscription, input.channel)
  const projected = current + projectedQuantity
  const exceeded = limit > 0 && projected > limit
  const remaining = limit > 0 ? Math.max(0, limit - current) : null

  return {
    ok: true as const,
    allowed: !subscription.hard_limit_enabled || !exceeded || subscription.hard_limit_behavior === 'notify_only',
    exceeded,
    current,
    projected,
    limit,
    remaining,
    behavior: subscription.hard_limit_behavior,
    subscription,
  }
}

export async function recordUsageEvent(admin: AdminClient, input: RecordUsageEventInput) {
  const occurredAt = input.occurredAt ?? new Date()
  const subscriptionResult = await getActiveSubscription(admin, input.tenantId, occurredAt)
  const subscriptionId = subscriptionResult.ok ? subscriptionResult.subscription.id : null

  const row = {
    theatre_id: input.tenantId,
    subscription_id: subscriptionId,
    module_key: input.moduleKey,
    channel: input.channel,
    event_type: input.eventType,
    quantity: input.quantity ?? 1,
    unit: input.unit,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    cost_estimate_cents: input.costEstimateCents ?? 0,
    idempotency_key: input.idempotencyKey ?? null,
    metadata: input.metadata ?? {},
    occurred_at: occurredAt.toISOString(),
  }

  const insert = input.idempotencyKey
    ? await admin
      .from('usage_events')
      .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('id')
      .maybeSingle()
    : await admin
      .from('usage_events')
      .insert(row)
      .select('id')
      .single()

  if (insert.error) {
    return { ok: false as const, error: insert.error.message }
  }

  if (!insert.data) {
    return { ok: true as const, duplicate: true }
  }

  const { error: aggregateError } = await admin.rpc('increment_tenant_usage_daily', {
    p_theatre_id: input.tenantId,
    p_date: toDateString(occurredAt),
    p_module_key: input.moduleKey,
    p_channel: input.channel,
    p_event_type: input.eventType,
    p_quantity: input.quantity ?? 1,
    p_input_tokens: input.inputTokens ?? 0,
    p_output_tokens: input.outputTokens ?? 0,
    p_cost_estimate_cents: input.costEstimateCents ?? 0,
  })

  if (aggregateError) {
    return { ok: false as const, error: aggregateError.message }
  }

  return { ok: true as const, duplicate: false, eventId: insert.data.id }
}

function getLimitForChannel(subscription: Tables<'tenant_subscriptions'>, channel: LimitCheckInput['channel']) {
  if (channel === 'email') return subscription.included_email_conversations
  if (channel === 'voice') return subscription.included_voice_minutes
  return subscription.included_chat_conversations
}

function getUsageForChannel(usage: UsageTotals, channel: LimitCheckInput['channel']) {
  if (channel === 'voice') return usage.voiceMinutes
  return usage.conversations
}

function sumUsageRows(rows: Array<{
  conversations: number
  messages: number
  ai_calls: number
  tool_calls: number
  input_tokens: number
  output_tokens: number
  voice_minutes: number
  resolutions: number
  fallbacks: number
  limit_exceeded_events: number
  estimated_cost_cents: number
}>): UsageTotals {
  return rows.reduce<UsageTotals>((acc, row) => ({
    conversations: acc.conversations + row.conversations,
    messages: acc.messages + row.messages,
    aiCalls: acc.aiCalls + row.ai_calls,
    toolCalls: acc.toolCalls + row.tool_calls,
    inputTokens: acc.inputTokens + row.input_tokens,
    outputTokens: acc.outputTokens + row.output_tokens,
    voiceMinutes: acc.voiceMinutes + row.voice_minutes,
    resolutions: acc.resolutions + row.resolutions,
    fallbacks: acc.fallbacks + row.fallbacks,
    limitExceededEvents: acc.limitExceededEvents + row.limit_exceeded_events,
    estimatedCostCents: acc.estimatedCostCents + row.estimated_cost_cents,
  }), {
    conversations: 0,
    messages: 0,
    aiCalls: 0,
    toolCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    voiceMinutes: 0,
    resolutions: 0,
    fallbacks: 0,
    limitExceededEvents: 0,
    estimatedCostCents: 0,
  })
}

function normalizePlan(value: string | null | undefined): keyof typeof planDefaults {
  const plan = String(value ?? '').toLowerCase()
  if (plan === 'professional' || plan === 'profesional') return 'professional'
  if (plan === 'enterprise' || plan === 'empresa') return 'enterprise'
  if (plan === 'custom') return 'custom'
  return 'essential'
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}
