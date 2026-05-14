import { processEmailMessage } from '@/lib/email/service'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type ProcessEmailPayload = {
  tenant_id?: string
  tenantId?: string
  thread_id?: string
  threadId?: string
  message_id?: string
  messageId?: string
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

  const payload = await request.json() as ProcessEmailPayload
  const tenantId = payload.tenant_id ?? payload.tenantId

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 })
  }

  const result = await processEmailMessage(createAdminClient(), {
    tenantId,
    threadId: payload.thread_id ?? payload.threadId,
    messageId: payload.message_id ?? payload.messageId,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, details: 'details' in result ? result.details : undefined },
      { status: result.error.includes('configured') ? 503 : 422 },
    )
  }

  return NextResponse.json(result)
}
