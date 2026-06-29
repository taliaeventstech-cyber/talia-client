import { z } from 'zod'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { registerInstalledWebPage } from '@/lib/knowledge/ingestion'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'

const installedPageSchema = z.object({
  url: z.string().url().max(2_000),
  title: z.string().trim().max(200).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const parsed = installedPageSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return corsJson({ error: parsed.error.issues[0]?.message ?? 'invalid_request' }, { status: 400 })
  }

  if (!originMatchesUrl(request, parsed.data.url)) {
    return corsJson({ error: 'origin_mismatch' }, { status: 403 })
  }

  const admin = createAdminClient()
  const tenant = await getPublicWidgetConfig(admin, tenantId)
  if (!tenant.ok) return corsJson({ error: tenant.error }, { status: 404 })

  const result = await registerInstalledWebPage({
    admin,
    tenantId,
    url: parsed.data.url,
    title: parsed.data.title,
  })

  if (!result.ok) return corsJson({ error: result.message }, { status: 400 })
  return corsJson({ ok: true, source_id: result.sourceId })
}

export function OPTIONS() {
  return corsNoContent()
}

async function safeJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function originMatchesUrl(request: Request, value: string) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === new URL(value).origin
  } catch {
    return false
  }
}
