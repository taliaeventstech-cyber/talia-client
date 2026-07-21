import { authorizeInternalApiRequest } from '@/lib/auth/internal-api'
import { processEmailMessage } from '@/lib/email/service'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const processEmailPayloadSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  thread_id: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  message_id: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
}).refine((value) => value.tenant_id || value.tenantId, { message: 'Missing tenant_id' })

export async function POST(request: NextRequest) {
  const authorization = authorizeInternalApiRequest(request.headers.get('x-talia-internal-key'))
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const parsedPayload = processEmailPayloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsedPayload.success) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
  }

  const payload = parsedPayload.data
  const tenantId = payload.tenant_id ?? payload.tenantId
  if (!tenantId) return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })

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
