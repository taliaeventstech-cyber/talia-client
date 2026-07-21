import { buildLocalClearViewFallback, clearViewRequestSchema, generateClearView } from '@/lib/accessibility/clear-view'
import { isClearViewInputTooLarge } from '@/lib/accessibility/clear-view-security'
import { consumeRateLimit, getClientIp } from '@/lib/auth/security'
import { createClearViewProviderFromEnv } from '@/lib/accessibility/openai-clear-view-provider'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return corsJson({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = clearViewRequestSchema.safeParse(body)
  if (!parsed.success) {
    return corsJson(
      { error: parsed.error.issues[0]?.message ?? 'Invalid clear-view request' },
      { status: 400 },
    )
  }

  const input = parsed.data
  if (isClearViewInputTooLarge(input)) {
    return corsJson({ error: 'Clear-view request is too large' }, { status: 413 })
  }

  const limited = await consumeRateLimit([{
    key: `clear-view:${input.tenantId}:${getClientIp(request)}`,
    limit: 20,
    windowMs: 10 * 60_000,
  }])

  if (limited) {
    return corsJson(
      { error: limited.unavailable ? 'rate_limit_unavailable' : 'too_many_attempts' },
      {
        status: limited.unavailable ? 503 : 429,
        headers: limited.unavailable ? undefined : {
          'Retry-After': String(limited.retryAfterSeconds),
        },
      },
    )
  }

  const admin = createAdminClient()
  const domainSettings = await getTenantWidgetDomainSettings(admin, input.tenantId)
  if (!domainSettings.ok) {
    return corsJson({ error: domainSettings.error }, { status: 404 })
  }

  const domain = validateWidgetRequestDomain({
    request,
    pageUrl: input.url,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return corsJson({ error: domain.error }, { status: 403 })
  }

  const tenantResult = await getPublicWidgetConfig(admin, input.tenantId)

  if (!tenantResult.ok) {
    return corsJson({ error: tenantResult.error }, { status: 404 })
  }

  const accessibility = tenantResult.config.accessibility
  if (!accessibility.enabled || !accessibility.clearViewEnabled) {
    return corsJson({ error: 'Clear view is not enabled for this tenant' }, { status: 403 })
  }

  const provider = createClearViewProviderFromEnv()
  if (!provider) {
    return corsJson({
      clearView: buildLocalClearViewFallback(input.page),
      source: 'local_fallback',
    })
  }

  const result = await generateClearView(input, provider)
  if (!result.ok) {
    return corsJson({
      clearView: buildLocalClearViewFallback(input.page),
      source: 'local_fallback',
      warning: result.error,
    })
  }

  return corsJson({
    clearView: result.clearView,
    source: 'ai',
  })
}

export function OPTIONS() {
  return corsNoContent()
}
