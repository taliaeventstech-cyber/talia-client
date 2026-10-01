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

const REPLY_REVISION = 'rpc-direct-2026-10-01'
const replyHeaders = { 'X-Talia-Instagram-Reply-Revision': REPLY_REVISION }

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { outcome: 'invalid_request', errorCode: 'IG_REPLY_INVALID_REQUEST', revision: REPLY_REVISION },
      { status: 400, headers: replyHeaders },
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
    return NextResponse.json({ ...result, revision: REPLY_REVISION }, { headers: replyHeaders })
  } catch (error) {
    const diagnostic = getReplyDiagnostic(error)
    console.error('[instagram-handoff-api] reply failed', {
      tenantId,
      conversationId,
      actorUserId: access.userId,
      error,
    })
    return NextResponse.json(
      { outcome: 'server_error', ...diagnostic, revision: REPLY_REVISION },
      { status: 500, headers: replyHeaders },
    )
  }
}

function getReplyDiagnostic(error: unknown) {
  const message = error instanceof Error ? error.message : 'unknown_error'
  const errorCode = message.startsWith('instagram_operator_reply_prepare_failed:')
    ? 'IG_REPLY_PREPARE_FAILED'
    : message.startsWith('instagram_operator_reply_start_failed:')
      ? 'IG_REPLY_START_FAILED'
      : message === 'instagram_operator_reply_complete_failed'
        ? 'IG_REPLY_COMPLETE_FAILED'
        : message === 'instagram_operator_reply_failure_persist_failed'
          ? 'IG_REPLY_FAILURE_PERSIST_FAILED'
          : 'IG_REPLY_SERVER_ERROR'

  return {
    errorCode,
    diagnostic: message.slice(0, 300),
  }
}
