import { z } from 'zod'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { ingestWebSnapshotSource } from '@/lib/knowledge/ingestion'
import { verifyWebCaptureToken } from '@/lib/knowledge/web-capture-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { normalizeKnowledgeSourceUrl } from '@/lib/knowledge/source-url'

const MAX_CAPTURE_TEXT_LENGTH = 200_000
const MIN_CAPTURE_TEXT_LENGTH = 40

const captureSchema = z.object({
  token: z.string().min(20).max(5_000),
  url: z.string().url().max(2_000),
  title: z.string().trim().max(200).optional(),
  text: z.string().trim().min(MIN_CAPTURE_TEXT_LENGTH).max(MAX_CAPTURE_TEXT_LENGTH),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const parsed = captureSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return corsJson({ error: parsed.error.issues[0]?.message ?? 'invalid_request' }, { status: 400 })
  }

  let token
  try {
    token = verifyWebCaptureToken(parsed.data.token)
  } catch (error) {
    return corsJson({ error: error instanceof Error ? error.message : 'invalid_capture_token' }, { status: 401 })
  }

  if (token.tenantId !== tenantId || token.url !== normalizeKnowledgeSourceUrl(parsed.data.url)) {
    return corsJson({ error: 'capture_token_mismatch' }, { status: 403 })
  }

  const admin = createAdminClient()
  const domainSettings = await getTenantWidgetDomainSettings(admin, tenantId)
  if (!domainSettings.ok) {
    return corsJson({ error: domainSettings.error }, { status: 404 })
  }

  const domain = validateWidgetRequestDomain({
    request,
    pageUrl: parsed.data.url,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return corsJson({ error: domain.error }, { status: 403 })
  }

  const tenant = await getPublicWidgetConfig(admin, tenantId)
  if (!tenant.ok) return corsJson({ error: tenant.error }, { status: 404 })

  const result = await ingestWebSnapshotSource({
    admin,
    tenantId,
    sourceId: token.sourceId,
    url: parsed.data.url,
    title: parsed.data.title,
    text: parsed.data.text,
  })

  if (!result.ok) {
    return corsJson({ ok: false, error: result.message }, { status: 422 })
  }

  return corsJson({ ok: true, chunks: result.count ?? 0 })
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
