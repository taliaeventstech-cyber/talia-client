import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { createWebCaptureBatchToken } from '@/lib/knowledge/web-capture-token'
import { getSignedCaptureUrl } from '@/lib/knowledge/web-capture-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const batchCaptureSchema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1).max(20),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')

  const sourceId = request.nextUrl.searchParams.get('sourceId')
  if (!sourceId) {
    return NextResponse.json({ error: 'source_id_required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: source, error } = await admin
    .from('knowledge_sources')
    .select('id, source_url, type')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!source?.source_url) {
    return NextResponse.json({ error: 'source_not_found' }, { status: 404 })
  }

  return NextResponse.json({ captureUrl: getSignedCaptureUrl({
    tenantId,
    sourceId: source.id,
    sourceUrl: source.source_url,
  }) })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')

  const parsed = batchCaptureSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: sources, error } = await admin
    .from('knowledge_sources')
    .select('id, source_url, type')
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')
    .in('id', parsed.data.sourceIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const validSourceIds = new Set((sources ?? [])
    .filter((source) => Boolean(source.source_url))
    .map((source) => source.id))
  const orderedSourceIds = parsed.data.sourceIds.filter((sourceId) => validSourceIds.has(sourceId))
  const firstSource = (sources ?? []).find((source) => source.id === orderedSourceIds[0])

  if (!firstSource?.source_url) {
    return NextResponse.json({ error: 'source_not_found' }, { status: 404 })
  }

  const batchToken = createWebCaptureBatchToken({
    tenantId,
    sourceIds: orderedSourceIds,
  })

  return NextResponse.json({
    captureUrl: getSignedCaptureUrl({
      tenantId,
      sourceId: firstSource.id,
      sourceUrl: firstSource.source_url,
      batchToken,
      batchIndex: 0,
      batchTotal: orderedSourceIds.length,
    }),
    total: orderedSourceIds.length,
  })
}

async function safeJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}
