import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json, Tables } from '@/types/database.types'
import { WEB_USAGE_CHANNEL_KEYS, type AttentionChannel } from '@/lib/attention/channel-agent'
import { getBillingPlan } from '@/lib/billing/plans'

type AdminClient = ReturnType<typeof createAdminClient>

export type UsageModuleKey = AttentionChannel | 'data' | 'marketing'
export type UsageChannel = AttentionChannel | 'backstage' | 'system'
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

export type TenantUsageHistoryEntry = {
  subscriptionId: string
  periodStart: string
  periodEnd: string
  periodStartAt: string
  periodEndAt: string
  plan: string
  status: string
  includedChatMessages: number
  billableChatMessages: number
  visitorChatMessages: number
  totalChatMessages: number
  unansweredChatMessages: number
  usage: UsageTotals
  isCurrent: boolean
}

type UsageHistorySubscription = Pick<
  Tables<'tenant_subscriptions'>,
  | 'id'
  | 'billing_period_start'
  | 'billing_period_end'
  | 'billing_period_start_at'
  | 'billing_period_end_at'
  | 'plan'
  | 'status'
  | 'included_chat_conversations'
>

export type BillingPeriod = {
  startDate: string
  endDate: string
  startAt: string
  endAt: string
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
  channel: 'web' | 'email' | 'voice'
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
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  }
}

export async function getActiveSubscription(admin: AdminClient, tenantId: string, referenceDate = new Date()) {
  const referenceAt = referenceDate.toISOString()
  const { data: existing, error: existingError } = await admin
    .from('tenant_subscriptions')
    .select('*')
    .eq('theatre_id', tenantId)
    .lte('billing_period_start_at', referenceAt)
    .gt('billing_period_end_at', referenceAt)
    .order('billing_period_start_at', { ascending: false })
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
    .select('plan, accounts(status, metadata)')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError) {
    return { ok: false as const, error: tenantError.message }
  }

  const plan = normalizePlan(tenant?.plan)
  const defaults = planDefaults[plan]
  const account = Array.isArray(tenant?.accounts) ? tenant.accounts[0] : tenant?.accounts
  const accountMetadata = isPlainObject(account?.metadata) ? account.metadata : {}
  const annualPeriod = account?.status === 'active' && accountMetadata.billing_cadence === 'yearly'
    ? getAnnualUsagePeriod(accountMetadata, referenceDate)
    : null
  const period = annualPeriod ?? getCurrentBillingPeriod(referenceDate)
  const commercialPlan = getBillingPlan(typeof accountMetadata.commercial_plan === 'string' ? accountMetadata.commercial_plan : null)
  const { data: created, error: createError } = await admin
    .from('tenant_subscriptions')
    .insert({
      theatre_id: tenantId,
      plan,
      billing_period_start: period.startDate,
      billing_period_end: period.endDate,
      billing_period_start_at: period.startAt,
      billing_period_end_at: period.endAt,
      included_chat_conversations: commercialPlan?.includedChatConversations ?? defaults.includedChatConversations,
      included_email_conversations: commercialPlan?.includedEmailConversations ?? defaults.includedEmailConversations,
      included_voice_minutes: defaults.includedVoiceMinutes,
      overage_price_chat_cents: defaults.overagePriceChatCents,
      overage_price_email_cents: defaults.overagePriceEmailCents,
      overage_price_voice_minute_cents: defaults.overagePriceVoiceMinuteCents,
      hard_limit_enabled: true,
      hard_limit_behavior: 'fallback',
      metadata: annualPeriod ? {
        billing_cadence: 'yearly',
        stripe_subscription_id: accountMetadata.stripe_subscription_id ?? null,
        stripe_current_period_start: accountMetadata.stripe_current_period_start ?? null,
        stripe_current_period_end: accountMetadata.stripe_current_period_end ?? null,
        plan_key: commercialPlan?.key ?? null,
      } : {},
    })
    .select('*')
    .single()

  if (createError || !created) {
    return { ok: false as const, error: createError?.message ?? 'Could not create subscription period' }
  }

  return { ok: true as const, subscription: created }
}

function getAnnualUsagePeriod(metadata: Record<string, Json | undefined>, referenceDate: Date): BillingPeriod | null {
  const startSeconds = typeof metadata.stripe_current_period_start === 'number' ? metadata.stripe_current_period_start : null
  const endSeconds = typeof metadata.stripe_current_period_end === 'number' ? metadata.stripe_current_period_end : null
  if (!startSeconds || !endSeconds) return null
  const subscriptionStart = new Date(startSeconds * 1000)
  const subscriptionEnd = new Date(endSeconds * 1000)
  if (referenceDate < subscriptionStart || referenceDate >= subscriptionEnd) return null

  let monthIndex = (
    (referenceDate.getUTCFullYear() - subscriptionStart.getUTCFullYear()) * 12
    + referenceDate.getUTCMonth() - subscriptionStart.getUTCMonth()
  )
  let start = addUtcMonthsClamped(subscriptionStart, monthIndex)
  if (start > referenceDate) {
    monthIndex -= 1
    start = addUtcMonthsClamped(subscriptionStart, monthIndex)
  }
  const end = new Date(Math.min(addUtcMonthsClamped(subscriptionStart, monthIndex + 1).getTime(), subscriptionEnd.getTime()))
  return { startDate: toDateString(start), endDate: toDateString(end), startAt: start.toISOString(), endAt: end.toISOString() }
}

function addUtcMonthsClamped(date: Date, months: number) {
  const absoluteMonth = date.getUTCMonth() + months
  const targetYear = date.getUTCFullYear() + Math.floor(absoluteMonth / 12)
  const targetMonth = ((absoluteMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()))
}

function isPlainObject(value: unknown): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Billable chatbot usage follows the Botsonic model: only assistant replies
 * generated by TALIA count against the plan limit. Visitor messages and
 * degraded fallback replies (no model call) do not consume quota.
 */
export async function getChatbotBillableMessagesForPeriod(
  admin: AdminClient,
  tenantId: string,
  period: Pick<BillingPeriod, 'startAt' | 'endAt'> = getCurrentBillingPeriod(),
) {
  const { count, error } = await admin
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('theatre_id', tenantId)
    .in('channel', [...WEB_USAGE_CHANNEL_KEYS])
    .eq('event_type', 'message')
    .eq('metadata->>role', 'assistant')
    .gte('occurred_at', period.startAt)
    .lt('occurred_at', period.endAt)

  if (error) {
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const, count: count ?? 0 }
}

export async function getTenantUsageForPeriod(
  admin: AdminClient,
  tenantId: string,
  period: Pick<BillingPeriod, 'startAt' | 'endAt'> = getCurrentBillingPeriod(),
) {
  const { data, error } = await admin
    .rpc('get_tenant_usage_totals', {
      p_theatre_id: tenantId,
      p_period_start: period.startAt,
      p_period_end: period.endAt,
    })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  return {
    ok: true as const,
    usage: mapUsageTotals(data?.[0]),
  }
}

export async function getTenantUsageHistory(
  admin: AdminClient,
  tenantId: string,
  options: { limit?: number; referenceDate?: Date } = {},
) {
  const limit = Math.min(12, Math.max(1, options.limit ?? 12))
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from('tenant_subscriptions')
    .select('id,billing_period_start,billing_period_end,billing_period_start_at,billing_period_end_at,plan,status,included_chat_conversations')
    .eq('theatre_id', tenantId)
    .order('billing_period_start_at', { ascending: false })
    .limit(limit)

  if (subscriptionsError) {
    return { ok: false as const, error: subscriptionsError.message }
  }

  if (!subscriptions?.length) {
    return { ok: true as const, history: [] as TenantUsageHistoryEntry[] }
  }

  const [usageResults, billableResults] = await Promise.all([
    Promise.all(subscriptions.map((subscription) => getTenantUsageForPeriod(admin, tenantId, {
      startAt: subscription.billing_period_start_at,
      endAt: subscription.billing_period_end_at,
    }))),
    Promise.all(subscriptions.map((subscription) => admin
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .in('channel', [...WEB_USAGE_CHANNEL_KEYS])
      .eq('event_type', 'message')
      .eq('metadata->>role', 'assistant')
      .gte('occurred_at', subscription.billing_period_start_at)
      .lt('occurred_at', subscription.billing_period_end_at))),
  ])

  const usageError = usageResults.find((result) => !result.ok)
  if (usageError && !usageError.ok) return usageError
  const billableError = billableResults.find((result) => result.error)?.error
  if (billableError) return { ok: false as const, error: billableError.message }

  return {
    ok: true as const,
    history: buildTenantUsageHistory({
      subscriptions,
      usageBySubscription: Object.fromEntries(
        subscriptions.map((subscription, index) => [
          subscription.id,
          usageResults[index].ok ? usageResults[index].usage : emptyUsageTotals(),
        ]),
      ),
      billableCounts: Object.fromEntries(
        subscriptions.map((subscription, index) => [subscription.id, billableResults[index].count ?? 0]),
      ),
      referenceDate: options.referenceDate,
    }),
  }
}

export function buildTenantUsageHistory({
  subscriptions,
  usageBySubscription,
  billableCounts,
  referenceDate = new Date(),
}: {
  subscriptions: UsageHistorySubscription[]
  usageBySubscription: Record<string, UsageTotals>
  billableCounts: Record<string, number>
  referenceDate?: Date
}): TenantUsageHistoryEntry[] {
  const reference = referenceDate.toISOString()

  return subscriptions.map((subscription) => {
    const isWithinExactPeriod = (value: string) => (
      value >= subscription.billing_period_start_at && value < subscription.billing_period_end_at
    )
    const usage = usageBySubscription[subscription.id] ?? emptyUsageTotals()
    const billableChatMessages = billableCounts[subscription.id] ?? 0
    const visitorChatMessages = Math.max(0, usage.messages - billableChatMessages)

    return {
      subscriptionId: subscription.id,
      periodStart: subscription.billing_period_start,
      periodEnd: subscription.billing_period_end,
      periodStartAt: subscription.billing_period_start_at,
      periodEndAt: subscription.billing_period_end_at,
      plan: subscription.plan,
      status: subscription.status,
      includedChatMessages: subscription.included_chat_conversations,
      billableChatMessages,
      visitorChatMessages,
      totalChatMessages: usage.messages,
      unansweredChatMessages: Math.max(0, visitorChatMessages - billableChatMessages),
      usage,
      isCurrent: isWithinExactPeriod(reference),
    }
  })
}

export async function checkTenantLimit(admin: AdminClient, input: LimitCheckInput) {
  const subscriptionResult = await getActiveSubscription(admin, input.tenantId)
  if (!subscriptionResult.ok) return subscriptionResult

  const subscription = subscriptionResult.subscription
  const period = {
    startDate: subscription.billing_period_start,
    endDate: subscription.billing_period_end,
    startAt: subscription.billing_period_start_at,
    endAt: subscription.billing_period_end_at,
  }

  let current: number
  if (input.channel === 'web') {
    const billableResult = await getChatbotBillableMessagesForPeriod(admin, input.tenantId, period)
    if (!billableResult.ok) return billableResult
    current = billableResult.count
  } else {
    const usageResult = await getTenantUsageForPeriod(admin, input.tenantId, {
      startAt: period.startAt,
      endAt: period.endAt,
    })
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
    if (!input.idempotencyKey) return { ok: true as const, duplicate: true }

    const { data: existing, error: existingError } = await admin
      .from('usage_events')
      .select('id')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()

    if (existingError || !existing) {
      return { ok: false as const, error: existingError?.message ?? 'Could not resolve duplicate usage event' }
    }

    return { ok: true as const, duplicate: true, eventId: existing.id }
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

function mapUsageTotals(row: {
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
} | undefined): UsageTotals {
  if (!row) return emptyUsageTotals()
  return {
    conversations: Number(row.conversations),
    messages: Number(row.messages),
    aiCalls: Number(row.ai_calls),
    toolCalls: Number(row.tool_calls),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    voiceMinutes: Number(row.voice_minutes),
    resolutions: Number(row.resolutions),
    fallbacks: Number(row.fallbacks),
    limitExceededEvents: Number(row.limit_exceeded_events),
    estimatedCostCents: Number(row.estimated_cost_cents),
  }
}

function emptyUsageTotals(): UsageTotals {
  return {
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
  }
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
