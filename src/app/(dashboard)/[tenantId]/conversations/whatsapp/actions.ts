'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getWhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  claimWhatsappHandoff,
  resolveWhatsappHandoff,
  sendWhatsappOperatorReply,
} from '@/lib/whatsapp/operator-handoff'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type WhatsappHandoffActionState = {
  ok: boolean
  message: string
  resultId?: string
}

const idSchema = z.uuid()
const replySchema = z.object({
  body: z.string().trim().min(1).max(4096),
  idempotencyKey: z.uuid(),
})

export async function claimWhatsappHandoffAction(
  tenantId: string,
  conversationId: string,
  locale: string,
  _previousState: WhatsappHandoffActionState,
  _formData: FormData,
): Promise<WhatsappHandoffActionState> {
  void _previousState
  void _formData
  const copy = getWhatsappHandoffCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'whatsapp')
  try {
    const outcome = await claimWhatsappHandoff(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateHandoffPaths(tenantId, conversationId)
    if (outcome === 'claimed') return success(copy.claimed)
    if (outcome === 'already_claimed') return success(copy.alreadyClaimed)
    if (outcome === 'already_assigned') return { ok: false, message: copy.alreadyAssigned }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[whatsapp-handoff] claim failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function sendWhatsappOperatorReplyAction(
  tenantId: string,
  conversationId: string,
  locale: string,
  _previousState: WhatsappHandoffActionState,
  formData: FormData,
): Promise<WhatsappHandoffActionState> {
  void _previousState
  const copy = getWhatsappHandoffCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }
  const parsed = replySchema.safeParse({
    body: formData.get('body'),
    idempotencyKey: formData.get('idempotencyKey'),
  })
  if (!parsed.success) return { ok: false, message: copy.invalidReply }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'whatsapp')
  try {
    const result = await sendWhatsappOperatorReply(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
      body: parsed.data.body,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    revalidateHandoffPaths(tenantId, conversationId)
    if (result.outcome === 'sent' || result.outcome === 'already_sent') return success(copy.sent)
    if (result.outcome === 'failed') return { ok: false, message: copy.sendFailed }
    if (result.outcome === 'uncertain') return { ok: false, message: copy.uncertain }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[whatsapp-handoff] reply failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function resolveWhatsappHandoffAction(
  tenantId: string,
  conversationId: string,
  locale: string,
  _previousState: WhatsappHandoffActionState,
  _formData: FormData,
): Promise<WhatsappHandoffActionState> {
  void _previousState
  void _formData
  const copy = getWhatsappHandoffCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'whatsapp')
  try {
    const outcome = await resolveWhatsappHandoff(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateHandoffPaths(tenantId, conversationId)
    return outcome === 'resolved'
      ? success(copy.resolved)
      : { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[whatsapp-handoff] resolve failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

function revalidateHandoffPaths(tenantId: string, conversationId: string) {
  revalidatePath(`/${tenantId}/whatsapp`)
  revalidatePath(`/${tenantId}/whatsapp/attention`)
  revalidatePath(`/${tenantId}/whatsapp/${conversationId}`)
}

function success(message: string): WhatsappHandoffActionState {
  return { ok: true, message, resultId: crypto.randomUUID() }
}
