import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { createWebCaptureBatchToken } from '@/lib/knowledge/web-capture-token'
import { getSignedCaptureUrl } from '@/lib/knowledge/web-capture-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Ids are installed pages (knowledge_documents rows of the venue's
// installed-web source). The query parameters keep their historical names.
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
      pageIds: parsedSourceIds.data.sourceIds,
      origin: request.nextUrl.origin,
      redirect: request.nextUrl.searchParams.get('redirect') === '1',
    })
  }

  const pageId = request.nextUrl.searchParams.get('sourceId')
  if (!pageId || !z.string().uuid().safeParse(pageId).success) {
    return noStoreJson({ error: 'source_id_required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: pages, error } = await loadInstalledPages(admin, tenantId, [pageId])

  if (error) {
    return noStoreJson({ error: error.message }, { status: 500 })
  }

  const page = pages?.[0]
  if (!page?.canonical_url) {
    return noStoreJson({ error: 'source_not_found' }, { status: 404 })
  }

  const captureUrl = getSignedCaptureUrl({
    tenantId,
    documentId: page.id,
    sourceUrl: page.canonical_url,
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
    pageIds: parsed.data.sourceIds,
    origin: request.nextUrl.origin,
    redirect: false,
  })
}

function loadInstalledPages(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  pageIds: string[],
) {
  return admin
    .from('knowledge_documents')
    .select('id, canonical_url, knowledge_sources!inner(type)')
    .eq('theatre_id', tenantId)
    .eq('knowledge_sources.type', 'web_snapshot')
    .in('id', pageIds)
}

async function createBatchCaptureResponse({
  tenantId,
  pageIds,
  origin,
  redirect,
}: {
  tenantId: string
  pageIds: string[]
  origin: string
  redirect: boolean
}) {
  const admin = createAdminClient()
  const { data: pages, error } = await loadInstalledPages(admin, tenantId, pageIds)

  if (error) {
    return noStoreJson({ error: error.message }, { status: 500 })
  }

  const validPageIds = new Set((pages ?? [])
    .filter((page) => Boolean(page.canonical_url))
    .map((page) => page.id))
  const orderedPageIds = pageIds.filter((pageId) => validPageIds.has(pageId))
  const firstPage = (pages ?? []).find((page) => page.id === orderedPageIds[0])

  if (!firstPage?.canonical_url) {
    return noStoreJson({ error: 'source_not_found' }, { status: 404 })
  }

  const batchToken = createWebCaptureBatchToken({
    tenantId,
    documentIds: orderedPageIds,
    expiresInSeconds: CAPTURE_BATCH_TOKEN_TTL_SECONDS,
  })

  const captureUrl = getSignedCaptureUrl({
    tenantId,
    documentId: firstPage.id,
    sourceUrl: firstPage.canonical_url,
    captureApiBase: origin,
    batchToken,
    batchIndex: 0,
    batchTotal: orderedPageIds.length,
  })

  if (redirect) {
    return noStoreRedirect(captureUrl)
  }

  return noStoreJson({
    captureUrl,
    total: orderedPageIds.length,
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
