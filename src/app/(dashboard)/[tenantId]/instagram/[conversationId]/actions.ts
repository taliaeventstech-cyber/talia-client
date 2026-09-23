'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getInstagramConversationCopy } from '@/lib/i18n/instagram-conversation-copy'
import {
  claimInstagramHandoff,
  ignoreInstagramHandoff,
  sendInstagramOperatorReply,
} from '@/lib/instagram/operator-handoff'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type InstagramHandoffActionState = {
  ok: boolean
  message: string
  resultId?: string
}

const idSchema = z.uuid()
const replySchema = z.object({
  body: z.string().trim().min(1).max(1_000),
  idempotencyKey: z.uuid(),
})

export async function claimInstagramHandoffAction(
  tenantId: string,
  conversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  _formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  void _formData
  const copy = getInstagramConversationCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'instagram')
  try {
    const outcome = await claimInstagramHandoff(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateInstagramPaths(tenantId, conversationId)
    if (outcome === 'claimed') return success(copy.claimed)
    if (outcome === 'already_claimed') return success(copy.alreadyClaimed)
    if (outcome === 'already_assigned') return { ok: false, message: copy.alreadyAssigned }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[instagram-handoff] claim failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function sendInstagramOperatorReplyAction(
  tenantId: string,
  conversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  const copy = getInstagramConversationCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }
  const parsed = replySchema.safeParse({
    body: formData.get('body'),
    idempotencyKey: formData.get('idempotencyKey'),
  })
  if (!parsed.success) return { ok: false, message: copy.invalidReply }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'instagram')
  try {
    const result = await sendInstagramOperatorReply(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
      body: parsed.data.body,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    revalidateInstagramPaths(tenantId, conversationId)
    if (result.outcome === 'sent' || result.outcome === 'already_sent') {
      return { ...success(copy.sent), resultId: result.outboundMessageId }
    }
    if (result.outcome === 'human_agent_window_expired') return { ok: false, message: copy.expired }
    if (result.outcome === 'failed') return { ok: false, message: copy.sendFailed }
    if (result.outcome === 'uncertain') return { ok: false, message: copy.uncertain }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[instagram-handoff] reply failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function ignoreInstagramHandoffAction(
  tenantId: string,
  conversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  _formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  void _formData
  const copy = getInstagramConversationCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'instagram')
  try {
    const outcome = await ignoreInstagramHandoff(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateInstagramPaths(tenantId, conversationId)
    if (outcome === 'ignored') return success(copy.ignored)
    if (outcome === 'already_assigned') return { ok: false, message: copy.alreadyAssigned }
    if (outcome === 'send_in_progress') return { ok: false, message: copy.sendInProgress }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[instagram-handoff] ignore failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

function revalidateInstagramPaths(tenantId: string, conversationId: string) {
  revalidatePath(`/${tenantId}/instagram`)
  revalidatePath(`/${tenantId}/instagram/${conversationId}`)
}

function success(message: string): InstagramHandoffActionState {
  return { ok: true, message }
}
