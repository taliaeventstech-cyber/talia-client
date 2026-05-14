import { syncAndMaybeProcessEmail } from '@/lib/email/automation'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type SyncEmailPayload = {
  tenant_id?: string
  tenantId?: string
  max_results?: number
  maxResults?: number
  query?: string
}

export async function POST(request: NextRequest) {
  const internalKey = process.env.INTERNAL_API_KEY
  const providedKey = request.headers.get('x-talia-internal-key')

  if (!internalKey && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Internal API key not configured' }, { status: 503 })
  }

  if (internalKey && providedKey !== internalKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json() as SyncEmailPayload
  const tenantId = payload.tenant_id ?? payload.tenantId

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 })
  }

  const result = payload.query || payload.max_results || payload.maxResults
    ? await syncSingleTenantWithOverrides(tenantId, payload)
    : await syncAndMaybeProcessEmail(createAdminClient(), tenantId)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, details: 'details' in result ? result.details : undefined },
      { status: 422 },
    )
  }

  return NextResponse.json(result)
}

async function syncSingleTenantWithOverrides(tenantId: string, payload: SyncEmailPayload) {
  const { processEmailMessage } = await import('@/lib/email/service')
  const { syncGmailMessages } = await import('@/lib/email/sync')
  const admin = createAdminClient()
  const result = await syncGmailMessages(admin, {
    tenantId,
    maxResults: payload.max_results ?? payload.maxResults,
    query: payload.query,
  })

  if (!result.ok) return result

  let processed = 0
  if (result.autoProcessAfterSync && result.imported > 0) {
    for (let index = 0; index < result.imported; index += 1) {
      const processResult = await processEmailMessage(admin, { tenantId })
      if (!processResult.ok) break
      processed += 1
    }
  }

  return { ...result, tenantId, processed }
}
