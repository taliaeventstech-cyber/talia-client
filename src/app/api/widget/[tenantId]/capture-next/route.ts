import { corsJson, corsNoContent } from '@/lib/http/cors'
import { verifyWebCaptureBatchToken } from '@/lib/knowledge/web-capture-token'
import { getSignedCaptureUrl } from '@/lib/knowledge/web-capture-url'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const nextSourceId = batch.sourceIds[nextIndex]
  if (!nextSourceId) {
    return corsJson({ done: true, total: batch.sourceIds.length })
  }

  const admin = createAdminClient()
  const { data: source, error } = await admin
    .from('knowledge_sources')
    .select('id, source_url')
    .eq('id', nextSourceId)
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')
    .maybeSingle()

  if (error) {
    return corsJson({ error: error.message }, { status: 500 })
  }

  if (!source?.source_url) {
    return corsJson({ error: 'source_not_found' }, { status: 404 })
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
