import { consumeRateLimit, getClientIp } from '@/lib/auth/security'
import { corsJson } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { checkTenantLimit, recordUsageEvent } from '@/lib/usage/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { createSpeechProviderFromEnv, type SpeechProvider } from './openai-speech-provider'

type AdminClient = ReturnType<typeof createAdminClient>

export type VoiceRequestKind = 'transcribe' | 'speech'

export type VoiceGuardResult =
  | { ok: true; admin: AdminClient; provider: SpeechProvider }
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

  return { ok: true, admin, provider }
}

export async function recordVoiceUsage(
  admin: AdminClient,
  input: {
    tenantId: string
    sessionId: string
    component: 'speech_to_text' | 'text_to_speech'
    model: string
    inputTokens?: number
    outputTokens?: number
    metadata: Record<string, string | number | boolean | null>
  },
) {
  // Raw usage is stored for later reconciliation against OpenAI pricing; no
  // per-call cent estimate is hardcoded here.
  return recordUsageEvent(admin, {
    tenantId: input.tenantId,
    moduleKey: 'web',
    channel: 'web',
    eventType: 'ai_call',
    unit: 'call',
    quantity: 1,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    metadata: {
      ...input.metadata,
      session_id: input.sessionId,
      component: input.component,
      provider: 'openai',
      model: input.model,
    },
  })
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
