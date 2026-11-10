import { corsJson, corsNoContent } from '@/lib/http/cors'
import { verifyWebCaptureBatchToken } from '@/lib/knowledge/web-capture-token'
import { getSignedCaptureUrl } from '@/lib/knowledge/web-capture-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { z } from 'zod'

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
  const nextPageId = batch.documentIds[nextIndex]
  if (!nextPageId) {
    return corsJson({ done: true, total: batch.documentIds.length })
  }

  const admin = createAdminClient()
  const [domainSettings, pageResult] = await Promise.all([
    getTenantWidgetDomainSettings(admin, tenantId),
    admin
      .from('knowledge_documents')
      .select('id, canonical_url, knowledge_sources!inner(type)')
      .eq('id', nextPageId)
      .eq('theatre_id', tenantId)
      .eq('knowledge_sources.type', 'web_snapshot')
      .maybeSingle(),
  ])

  if (!domainSettings.ok) {
    return corsJson({ error: domainSettings.error }, { status: 404 })
  }
  if (pageResult.error) {
    return corsJson({ error: pageResult.error.message }, { status: 500 })
  }

  const page = pageResult.data
  if (!page?.canonical_url) {
    return corsJson({ error: 'source_not_found' }, { status: 404 })
  }

  const domain = validateWidgetRequestDomain({
    request,
    pageUrl: page.canonical_url,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return corsJson({ error: domain.error }, { status: 403 })
  }

  return corsJson({
    done: false,
    nextIndex,
    total: batch.documentIds.length,
    captureUrl: getSignedCaptureUrl({
      tenantId,
      documentId: page.id,
      sourceUrl: page.canonical_url,
      captureApiBase: new URL(request.url).origin,
      batchToken: parsed.data.batchToken,
      batchIndex: nextIndex,
      batchTotal: batch.documentIds.length,
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
