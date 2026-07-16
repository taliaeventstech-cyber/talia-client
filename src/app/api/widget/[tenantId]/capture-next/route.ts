import { corsJson, corsNoContent } from '@/lib/http/cors'
import { verifyWebCaptureBatchToken } from '@/lib/knowledge/web-capture-token'
import { getSignedCaptureUrl } from '@/lib/knowledge/web-capture-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { z } from 'zod'
import { getPublicWidgetConfig } from '@/lib/tenants/service'

const nextCaptureSchema = z.object({
  batchToken: z.string().min(20).max(20_000),
  currentIndex: z.number().int().min(0).max(50),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params
  const parsed = nextCaptureSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return corsJson({ error: parsed.error.issues[0]?.message ?? 'invalid_request' }, { status: 400 })
  }

  let batch
  try {
    batch = verifyWebCaptureBatchToken(parsed.data.batchToken)
  } catch (error) {
    return corsJson({ error: error instanceof Error ? error.message : 'invalid_capture_batch_token' }, { status: 401 })
  }

  if (batch.tenantId !== tenantId) {
    return corsJson({ error: 'capture_batch_mismatch' }, { status: 403 })
  }

  const nextIndex = parsed.data.currentIndex + 1
  const nextSourceId = batch.sourceIds[nextIndex]
  if (!nextSourceId) {
    return corsJson({ done: true, total: batch.sourceIds.length })
  }

  const admin = createAdminClient()
  const [domainSettings, sourceResult, tenant] = await Promise.all([
    getTenantWidgetDomainSettings(admin, tenantId),
    admin
      .from('knowledge_sources')
      .select('id, source_url')
      .eq('id', nextSourceId)
      .eq('theatre_id', tenantId)
      .eq('type', 'web_snapshot')
      .maybeSingle(),
    getPublicWidgetConfig(admin, tenantId),
  ])

  if (!domainSettings.ok) {
    return corsJson({ error: domainSettings.error }, { status: 404 })
  }
  if (!tenant.ok) return corsJson({ error: tenant.error }, { status: 404 })
  if (!tenant.config.installedWebCapture.enabled || tenant.config.installedWebCapture.mode !== 'manual') {
    return corsJson({ error: 'manual_capture_disabled' }, { status: 403 })
  }

  if (sourceResult.error) {
    return corsJson({ error: sourceResult.error.message }, { status: 500 })
  }

  const source = sourceResult.data
  if (!source?.source_url) {
    return corsJson({ error: 'source_not_found' }, { status: 404 })
  }

  const domain = validateWidgetRequestDomain({
    request,
    pageUrl: source.source_url,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return corsJson({ error: domain.error }, { status: 403 })
  }

  return corsJson({
    done: false,
    nextIndex,
    total: batch.sourceIds.length,
    captureUrl: getSignedCaptureUrl({
      tenantId,
      sourceId: source.id,
      sourceUrl: source.source_url,
      captureApiBase: new URL(request.url).origin,
      batchToken: parsed.data.batchToken,
      batchIndex: nextIndex,
      batchTotal: batch.sourceIds.length,
    }),
  })
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
