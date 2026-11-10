import { z } from 'zod'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { ingestWebSnapshotSource, registerInstalledWebPage } from '@/lib/knowledge/ingestion'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'

const installedPageSchema = z.object({
  url: z.string().trim().url().max(4_096),
  title: z
    .string()
    .optional()
    .transform((value) => {
      const title = value?.trim()
      return title ? title.slice(0, 200) : undefined
    }),
  heading: z.string().trim().max(300).optional(),
  http_status: z.number().int().min(100).max(599).optional(),
  text: z.string().trim().min(40).max(200_000).optional(),
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
  if (!tenant.config.installedWebCapture.enabled) {
    return corsJson({ error: 'installed_web_capture_disabled' }, { status: 403 })
  }

  const result = await registerInstalledWebPage({
    admin,
    tenantId,
    url: parsed.data.url,
    title: parsed.data.title,
    heading: parsed.data.heading,
    httpStatus: parsed.data.http_status,
  })

  if (!result.ok) return corsJson({ error: result.message }, { status: 400 })
  if (
    tenant.config.installedWebCapture.mode === 'automatic'
    && parsed.data.text
    && result.documentId
  ) {
    const ingest = await ingestWebSnapshotSource({
      admin,
      tenantId,
      documentId: result.documentId,
      url: parsed.data.url,
      title: parsed.data.title,
      heading: parsed.data.heading,
      httpStatus: parsed.data.http_status,
      text: parsed.data.text,
      captureMode: 'automatic',
    })
    if (!ingest.ok) return corsJson({ ok: false, error: ingest.message }, { status: 422 })
    return corsJson({ ok: true, source_id: result.sourceId, page_id: result.documentId, processed: true, chunks: ingest.count ?? 0 })
  }

  return corsJson({ ok: true, source_id: result.sourceId, page_id: result.documentId, processed: false })
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
