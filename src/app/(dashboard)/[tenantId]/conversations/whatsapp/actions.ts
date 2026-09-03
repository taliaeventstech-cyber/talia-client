'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getSupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'
import { getWhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import {
  getOrCreateManualKnowledgeSource,
  reindexStructuredKnowledgeSource,
} from '@/lib/knowledge/ingestion'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  claimWhatsappHandoff,
  getWhatsappHandoffDetail,
  ignoreWhatsappHandoff,
  releaseWhatsappConversation,
  sendWhatsappOperatorReply,
  takeOverWhatsappConversation,
} from '@/lib/whatsapp/operator-handoff'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type WhatsappHandoffActionState = {
  ok: boolean
  message: string
  resultId?: string
}

export type WhatsappSupervisedFaqState = {
  ok: boolean
  message: string
  knowledgeItemId?: string
}

const idSchema = z.uuid()
const replySchema = z.object({
  body: z.string().trim().min(1).max(4096),
  idempotencyKey: z.uuid(),
})
const supervisedFaqSchema = z.object({
  question: z.string().trim().min(4).max(500),
  answer: z.string().trim().min(4).max(4_000),
})

export async function takeOverWhatsappConversationAction(
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
    const outcome = await takeOverWhatsappConversation(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateHandoffPaths(tenantId, conversationId)
    if (outcome === 'taken_over') return success(copy.takenOver)
    if (outcome === 'already_taken_over') return success(copy.alreadyTakenOver)
    if (outcome === 'already_assigned') return { ok: false, message: copy.alreadyAssigned }
    if (outcome === 'send_in_progress') return { ok: false, message: copy.takeoverSendInProgress }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[whatsapp-manual-mode] takeover failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function releaseWhatsappConversationAction(
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
    const outcome = await releaseWhatsappConversation(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateHandoffPaths(tenantId, conversationId)
    if (outcome === 'released') return success(copy.released)
    if (outcome === 'send_in_progress') return { ok: false, message: copy.sendInProgress }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[whatsapp-manual-mode] release failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

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

export async function ignoreWhatsappHandoffAction(
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
    const outcome = await ignoreWhatsappHandoff(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateHandoffPaths(tenantId, conversationId)
    if (outcome === 'ignored') return success(copy.ignored)
    if (outcome === 'already_assigned') return { ok: false, message: copy.alreadyAssigned }
    if (outcome === 'send_in_progress') return { ok: false, message: copy.sendInProgress }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[whatsapp-handoff] ignore failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function createSupervisedFaqFromWhatsapp(
  tenantId: string,
  conversationId: string,
  assistantMessageId: string,
  locale: string,
  _previousState: WhatsappSupervisedFaqState,
  formData: FormData,
): Promise<WhatsappSupervisedFaqState> {
  void _previousState
  const copy = getSupervisedFaqCopy(locale).action
  const parsed = supervisedFaqSchema.safeParse({
    question: formData.get('question'),
    answer: formData.get('answer'),
  })
  if (!parsed.success) return { ok: false, message: copy.invalid }
  if (!idSchema.safeParse(conversationId).success || !idSchema.safeParse(assistantMessageId).success) {
    return { ok: false, message: copy.unavailable }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const conversationAccess = await requireTenantProductAccess(tenantId, 'view_conversations', 'whatsapp')
  const admin = createAdminClient()
  const [conversation, { data: theatre }] = await Promise.all([
    getWhatsappHandoffDetail(admin, {
      tenantId,
      conversationId,
      actorUserId: conversationAccess.userId,
    }),
    admin.from('theatres').select('account_id').eq('id', tenantId).maybeSingle(),
  ])
  const message = conversation?.messages.find((candidate) => candidate.id === assistantMessageId)
  if (
    !message
    || message.direction !== 'outbound'
    || message.is_operator_reply
    || !message.body_text
    || !['sent', 'delivered', 'read'].includes(message.delivery_status ?? '')
  ) {
    return { ok: false, message: copy.unavailable }
  }

  const existing = await admin
    .from('knowledge_items')
    .select('id')
    .eq('id', message.id)
    .eq('theatre_id', tenantId)
    .maybeSingle()
  if (existing.data) {
    return { ok: true, message: copy.alreadyCreated, knowledgeItemId: existing.data.id }
  }

  const source = await getOrCreateManualKnowledgeSource({ admin, tenantId })
  if (!source.ok) return { ok: false, message: copy.sourceError }

  const approvedAt = new Date().toISOString()
  const { data: item, error: insertError } = await admin
    .from('knowledge_items')
    .insert({
      id: message.id,
      theatre_id: tenantId,
      source_id: source.sourceId,
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: 'Aprendizaje supervisado',
      language: 'und',
      priority: 80,
      active: true,
      metadata: {
        origin: 'whatsapp_conversation_supervision',
        origin_channel: 'whatsapp',
        whatsapp_conversation_id: conversationId,
        whatsapp_message_id: message.id,
        approved_at: approvedAt,
      },
    })
    .select('id')
    .single()

  if (insertError || !item) {
    if (insertError?.code === '23505') {
      return { ok: true, message: copy.alreadyCreated, knowledgeItemId: message.id }
    }
    console.error('[whatsapp-supervision] failed to create FAQ', {
      tenantId,
      conversationId,
      assistantMessageId,
      error: insertError?.message ?? 'unknown',
    })
    return { ok: false, message: copy.createError }
  }

  const indexed = await reindexStructuredKnowledgeSource({
    admin,
    tenantId,
    sourceId: source.sourceId,
    sourceType: 'manual',
    sourceName: 'FAQs manuales',
    metadata: {
      trigger: 'whatsapp_conversation_supervision',
      whatsapp_message_id: message.id,
    },
  })
  const publicationStatus = indexed.ok ? 'indexed' : 'pending_index'
  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: theatre?.account_id ?? null,
    theatre_id: tenantId,
    actor_user_id: access.userId,
    action: 'knowledge.faq_created_from_whatsapp_conversation',
    target_type: 'knowledge_item',
    target_id: item.id,
    metadata: {
      whatsapp_conversation_id: conversationId,
      whatsapp_message_id: message.id,
      indexing_status: publicationStatus,
    },
  })
  if (auditError) console.error('[whatsapp-supervision] failed to audit FAQ', auditError)

  revalidateHandoffPaths(tenantId, conversationId)
  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    message: indexed.ok ? copy.indexed : copy.pendingIndex,
    knowledgeItemId: item.id,
  }
}

function revalidateHandoffPaths(tenantId: string, conversationId: string) {
  revalidatePath(`/${tenantId}/whatsapp`)
  revalidatePath(`/${tenantId}/whatsapp/${conversationId}`)
  revalidatePath(`/${tenantId}/conversations/whatsapp`)
  revalidatePath(`/${tenantId}/conversations/whatsapp/${conversationId}`)
}

function success(message: string): WhatsappHandoffActionState {
  return { ok: true, message, resultId: crypto.randomUUID() }
}
