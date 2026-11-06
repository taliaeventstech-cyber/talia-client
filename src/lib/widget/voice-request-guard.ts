import { consumeRateLimit, getClientIp } from '@/lib/auth/security'
import { corsJson } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { DEFAULT_AGENT_VOICE, type AgentVoice } from '@/lib/widget/agent-voices'
import { checkTenantLimit, recordUsageEvent } from '@/lib/usage/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { createSpeechProviderFromEnv, type SpeechProvider, type SpeechUsageComponent } from './talia-ai-speech-provider'

type AdminClient = ReturnType<typeof createAdminClient>

export type VoiceRequestKind = 'transcribe' | 'speech'

export type VoiceGuardResult =
  | { ok: true; admin: AdminClient; provider: SpeechProvider; agentVoice: AgentVoice }
  | { ok: false; response: Response }

// Speech calls happen at most once per visitor turn (transcription) or per
// reply chunk (synthesis), so these limits sit just above the chat limits.
const RATE_LIMITS: Record<VoiceRequestKind, { minute: number; tenMinutes: number }> = {
  transcribe: { minute: 15, tenMinutes: 60 },
  speech: { minute: 40, tenMinutes: 160 },
}

/**
 * Shared checks for the public Web Agent voice endpoints, in the same order as
 * the chat endpoint: provider configured → per-visitor rate limit → active
 * tenant with enabled widget → allowed embedding domain → usage limit.
 * Every rejection is a normal JSON error so the widget can fall back to the
 * browser's own speech engine.
 */
export async function guardVoiceRequest(
  request: Request,
  input: { tenantId: string; pageUrl: string | undefined; kind: VoiceRequestKind },
): Promise<VoiceGuardResult> {
  const provider = createSpeechProviderFromEnv()
  if (!provider) {
    return reject({ error: 'voice_unavailable' }, 503)
  }

  const ip = getClientIp(request)
  const limits = RATE_LIMITS[input.kind]
  const limited = await consumeRateLimit([
    { key: `voice-${input.kind}-minute:${input.tenantId}:${ip}`, limit: limits.minute, windowMs: 60_000 },
    { key: `voice-${input.kind}-ten-minutes:${input.tenantId}:${ip}`, limit: limits.tenMinutes, windowMs: 10 * 60_000 },
  ])
  if (limited) {
    return reject(
      { error: limited.unavailable ? 'rate_limit_unavailable' : 'too_many_attempts' },
      limited.unavailable ? 503 : 429,
      limited.unavailable ? undefined : { 'Retry-After': String(limited.retryAfterSeconds) },
    )
  }

  const admin = createAdminClient()
  const tenant = await getTenantChatConfig(admin, input.tenantId)
  if (!tenant.ok) {
    return reject({ error: tenant.error }, 404)
  }

  const domainSettings = await getTenantWidgetDomainSettings(admin, input.tenantId)
  if (!domainSettings.ok) {
    return reject({ error: domainSettings.error }, 404)
  }

  const domain = validateWidgetRequestDomain({
    request,
    pageUrl: input.pageUrl,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return reject({ error: domain.error }, 403)
  }

  // Voice is only useful while the venue can still receive answers. When the
  // chatbot allotment is blocked we skip the paid speech call entirely.
  const limit = await checkTenantLimit(admin, { tenantId: input.tenantId, channel: 'web', projectedQuantity: 1 })
  if (limit.ok && !limit.allowed) {
    return reject({ error: 'usage_limit_reached', code: 'usage_limit_reached' }, 402)
  }

  return { ok: true, admin, provider, agentVoice: tenant.config.agentVoice ?? DEFAULT_AGENT_VOICE }
}

/**
 * Records a voice call like the chat endpoint records its AI calls: one
 * `usage_events` row (`ai_call`) plus measured per-component cost rows in
 * `ai_usage_events`, priced from `ai_model_pricing`.
 */
export async function recordVoiceUsage(
  admin: AdminClient,
  input: {
    tenantId: string
    sessionId: string
    components: SpeechUsageComponent[]
    metadata: Record<string, string | number | boolean | null>
  },
) {
  if (!input.components.length) return

  const correlationId = crypto.randomUUID()
  const totals = input.components.reduce(
    (sum, component) => ({
      requestCount: sum.requestCount + component.request_count,
      inputTokens: sum.inputTokens + component.input_tokens,
      outputTokens: sum.outputTokens + component.output_tokens,
    }),
    { requestCount: 0, inputTokens: 0, outputTokens: 0 },
  )

  const aiCall = await recordUsageEvent(admin, {
    tenantId: input.tenantId,
    moduleKey: 'web',
    channel: 'web',
    eventType: 'ai_call',
    unit: 'call',
    quantity: totals.requestCount,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    idempotencyKey: `voice:${input.tenantId}:${correlationId}:ai_call`,
    metadata: {
      ...input.metadata,
      session_id: input.sessionId,
      accuracy: 'measured',
      component: input.components[0].component,
      provider: input.components[0].provider,
      model: input.components[0].model,
    },
  })

  if (!aiCall.ok || !aiCall.eventId) {
    console.error('[voice] failed to record usage event', { tenantId: input.tenantId })
    return
  }

  const precise = await recordMeasuredAiUsage(admin, {
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    usageEventId: aiCall.eventId,
    idempotencyPrefix: `voice:${input.tenantId}:${correlationId}:component`,
    components: input.components,
    metadata: { channel_feature: 'web_voice' },
  })

  if (!precise.ok) {
    console.error('[voice] failed to persist precise AI usage', { tenantId: input.tenantId })
  }
}

/**
 * Maps a talia-ai failure to the public error. When talia-ai is not deployed
 * yet (404), unreachable, or the provider is overloaded (503), the widget gets
 * 503 and switches to browser speech for the rest of the visit; other
 * failures are a one-off 502.
 */
export function voiceProviderFailure(status: number | undefined, error: 'transcription_failed' | 'speech_failed') {
  const unavailable = status === undefined || status === 404 || status === 503
  return corsJson(
    { error: unavailable ? 'voice_unavailable' : error },
    { status: unavailable ? 503 : 502 },
  )
}

export function normalizeVoicePageUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    url.hash = ''
    return url.toString()
  } catch {
    return undefined
  }
}

function reject(body: Record<string, string>, status: number, headers?: Record<string, string>): VoiceGuardResult {
  return { ok: false, response: corsJson(body, { status, headers }) }
}
