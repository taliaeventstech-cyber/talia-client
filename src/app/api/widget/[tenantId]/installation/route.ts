import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
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

  const origin = getRequestOrigin(request)
  if (!origin) return corsJson({ error: 'domain_not_allowed' }, { status: 403 })

  const recorded = await admin.rpc('record_widget_installation', {
    p_theatre_id: tenantId,
    p_origin: origin,
  })
  if (recorded.error || recorded.data !== true) {
    return corsJson({ error: 'installation_heartbeat_failed' }, { status: 503 })
  }

  return corsNoContent()
}

export function OPTIONS() {
  return corsNoContent()
}

function getRequestOrigin(request: Request) {
  const value = request.headers.get('origin') ?? request.headers.get('referer')
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}
