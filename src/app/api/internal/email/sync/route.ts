import { syncAndMaybeProcessEmail } from '@/lib/email/automation'
import { authorizeInternalApiRequest } from '@/lib/auth/internal-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const syncEmailPayloadSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  max_results: z.number().int().min(1).max(100).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(500).optional(),
}).refine((value) => value.tenant_id || value.tenantId, { message: 'Missing tenant_id' })

type SyncEmailPayload = z.infer<typeof syncEmailPayloadSchema>

export async function POST(request: NextRequest) {
  const authorization = authorizeInternalApiRequest(request.headers.get('x-talia-internal-key'))
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const parsedPayload = syncEmailPayloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsedPayload.success) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
  }

  const payload = parsedPayload.data
  const tenantId = payload.tenant_id ?? payload.tenantId
  if (!tenantId) return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })

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
