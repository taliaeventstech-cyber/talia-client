import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { sendInstagramOperatorReply } from '@/lib/instagram/operator-handoff'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const requestSchema = z.object({
  tenantId: z.uuid(),
  conversationId: z.uuid(),
  body: z.string().trim().min(1).max(1_000),
  idempotencyKey: z.uuid(),
})

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { outcome: 'invalid_request', errorCode: 'IG_REPLY_INVALID_REQUEST' },
      { status: 400 },
    )
  }

  const { tenantId, conversationId, body, idempotencyKey } = parsed.data
  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'instagram')

  try {
    const result = await sendInstagramOperatorReply(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
      body,
      idempotencyKey,
    })

    revalidatePath(`/${tenantId}/instagram`)
    revalidatePath(`/${tenantId}/instagram/${conversationId}`)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[instagram-handoff-api] reply failed', {
      tenantId,
      conversationId,
      actorUserId: access.userId,
      error,
    })
    return NextResponse.json(
      { outcome: 'server_error', errorCode: 'IG_REPLY_SERVER_ERROR' },
      { status: 500 },
    )
  }
}
