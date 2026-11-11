import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { getPublicVoiceConfig } from '@/lib/widget/speech'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const admin = createAdminClient()

  const domainSettings = await getTenantWidgetDomainSettings(admin, tenantId)
  if (!domainSettings.ok) {
    return corsJson({ error: domainSettings.error }, { status: 404 })
  }

  const domain = validateWidgetRequestDomain({
    request,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return corsJson({ error: domain.error }, { status: 403 })
  }

  const result = await getPublicWidgetConfig(admin, tenantId)

  if (!result.ok) {
    return corsJson({ error: result.error }, { status: 404 })
  }

  // Disabled widgets keep a minimal, silent configuration.
  if (result.config.enabled === false) return corsJson(result.config)

  // `voice.enabled: false` makes the widget hide every voice control.
  const voice = result.config.voiceEnabled === false ? { enabled: false } : getPublicVoiceConfig()
  return corsJson({ ...result.config, voice })
}

export function OPTIONS() {
  return corsNoContent()
}
