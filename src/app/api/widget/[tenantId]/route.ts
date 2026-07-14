import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'

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

  if (!result.config.enabled) {
    return corsJson({ error: 'Chatbot is disabled' }, { status: 404 })
  }

  return corsJson(result.config)
}

export function OPTIONS() {
  return corsNoContent()
}
