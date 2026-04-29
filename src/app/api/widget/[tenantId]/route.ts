import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const admin = createAdminClient()
  const result = await getPublicWidgetConfig(admin, tenantId)

  if (!result.ok) {
    return corsJson({ error: result.error }, { status: 404 })
  }

  return corsJson(result.config)
}

export function OPTIONS() {
  return corsNoContent()
}
