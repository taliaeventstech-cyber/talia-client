import { z } from 'zod'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { ingestWebSnapshotSource } from '@/lib/knowledge/ingestion'
import { verifyWebCaptureToken } from '@/lib/knowledge/web-capture-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicWidgetConfig } from '@/lib/tenants/service'

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

  if (token.tenantId !== tenantId || token.url !== stripHash(parsed.data.url)) {
    return corsJson({ error: 'capture_token_mismatch' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: theatre } = await admin
    .from('theatres')
    .select('website_url')
    .eq('id', tenantId)
    .maybeSingle()

  if (!originMatchesUrl(request, parsed.data.url) && !matchesOfficialWebsite(parsed.data.url, theatre?.website_url)) {
    return corsJson({ error: 'origin_mismatch' }, { status: 403 })
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

function originMatchesUrl(request: Request, value: string) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === new URL(value).origin
  } catch {
    return false
  }
}

function stripHash(value: string) {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

function matchesOfficialWebsite(value: string, officialWebsite?: string | null) {
  if (!officialWebsite) return false

  try {
    return new URL(value).origin === new URL(officialWebsite).origin
  } catch {
    return false
  }
}
