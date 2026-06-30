import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { createWebCaptureBatchToken } from '@/lib/knowledge/web-capture-token'
import { getSignedCaptureUrl } from '@/lib/knowledge/web-capture-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const batchCaptureSchema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1).max(20),
})
const CAPTURE_BATCH_TOKEN_TTL_SECONDS = 60 * 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')

  const sourceIdsParam = request.nextUrl.searchParams.get('sourceIds')
  if (sourceIdsParam) {
    const parsedSourceIds = batchCaptureSchema.safeParse({
      sourceIds: sourceIdsParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20),
    })
    if (!parsedSourceIds.success) {
      return noStoreJson({ error: parsedSourceIds.error.issues[0]?.message ?? 'invalid_request' }, { status: 400 })
    }
    return createBatchCaptureResponse({
      tenantId,
      sourceIds: parsedSourceIds.data.sourceIds,
      origin: request.nextUrl.origin,
      redirect: request.nextUrl.searchParams.get('redirect') === '1',
    })
  }

  const sourceId = request.nextUrl.searchParams.get('sourceId')
  if (!sourceId) {
    return noStoreJson({ error: 'source_id_required' }, { status: 400 })
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
    return noStoreJson({ error: error.message }, { status: 500 })
  }

  if (!source?.source_url) {
    return noStoreJson({ error: 'source_not_found' }, { status: 404 })
  }

  const captureUrl = getSignedCaptureUrl({
    tenantId,
    sourceId: source.id,
    sourceUrl: source.source_url,
    captureApiBase: request.nextUrl.origin,
  })

  if (request.nextUrl.searchParams.get('redirect') === '1') {
    return noStoreRedirect(captureUrl)
  }

  return noStoreJson({ captureUrl })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')

  const parsed = batchCaptureSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? 'invalid_request' }, { status: 400 })
  }

  return createBatchCaptureResponse({
    tenantId,
    sourceIds: parsed.data.sourceIds,
    origin: request.nextUrl.origin,
    redirect: false,
  })
}

async function createBatchCaptureResponse({
  tenantId,
  sourceIds,
  origin,
  redirect,
}: {
  tenantId: string
  sourceIds: string[]
  origin: string
  redirect: boolean
}) {
  const admin = createAdminClient()
  const { data: sources, error } = await admin
    .from('knowledge_sources')
    .select('id, source_url, type')
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')
    .in('id', sourceIds)

  if (error) {
    return noStoreJson({ error: error.message }, { status: 500 })
  }

  const validSourceIds = new Set((sources ?? [])
    .filter((source) => Boolean(source.source_url))
    .map((source) => source.id))
  const orderedSourceIds = sourceIds.filter((sourceId) => validSourceIds.has(sourceId))
  const firstSource = (sources ?? []).find((source) => source.id === orderedSourceIds[0])

  if (!firstSource?.source_url) {
    return noStoreJson({ error: 'source_not_found' }, { status: 404 })
  }

  const batchToken = createWebCaptureBatchToken({
    tenantId,
    sourceIds: orderedSourceIds,
    expiresInSeconds: CAPTURE_BATCH_TOKEN_TTL_SECONDS,
  })

  const captureUrl = getSignedCaptureUrl({
    tenantId,
    sourceId: firstSource.id,
    sourceUrl: firstSource.source_url,
    captureApiBase: origin,
    batchToken,
    batchIndex: 0,
    batchTotal: orderedSourceIds.length,
  })

  if (redirect) {
    return noStoreRedirect(captureUrl)
  }

  return noStoreJson({
    captureUrl,
    total: orderedSourceIds.length,
  })
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      ...init?.headers,
    },
  })
}

function noStoreRedirect(url: string) {
  return NextResponse.redirect(url, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

async function safeJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}
