'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getInstagramConversationCopy } from '@/lib/i18n/instagram-conversation-copy'
import { getSupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'
import { getInstagramConversationDetail } from '@/lib/instagram/conversations'
import { resolveInstagramActionConversationId } from '@/lib/instagram/action-conversation-id'
import {
  claimInstagramHandoff,
  ignoreInstagramHandoff,
  releaseInstagramConversation,
  sendInstagramOperatorReply,
  takeOverInstagramConversation,
} from '@/lib/instagram/operator-handoff'
import {
  getOrCreateManualKnowledgeSource,
  reindexStructuredKnowledgeSource,
} from '@/lib/knowledge/ingestion'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type InstagramHandoffActionState = {
  ok: boolean
  message: string
  resultId?: string
}

export type InstagramSupervisedFaqState = {
  ok: boolean
  message: string
  knowledgeItemId?: string
}

const idSchema = z.uuid()
const replySchema = z.object({
  body: z.string().trim().min(1).max(1_000),
  idempotencyKey: z.uuid(),
})
const supervisedFaqSchema = z.object({
  question: z.string().trim().min(4).max(500),
  answer: z.string().trim().min(4).max(4_000),
})

export async function takeOverInstagramConversationAction(
  tenantId: string,
  boundConversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  const conversationId = resolveInstagramActionConversationId(boundConversationId, formData)
  const copy = getInstagramConversationCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'instagram')
  try {
    const outcome = await takeOverInstagramConversation(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateInstagramPaths(tenantId, conversationId)
    if (outcome === 'taken_over') return success(copy.takenOver)
    if (outcome === 'already_taken_over') return success(copy.alreadyTakenOver)
    if (outcome === 'already_assigned') return { ok: false, message: copy.alreadyAssigned }
    if (outcome === 'send_in_progress') return { ok: false, message: copy.takeoverSendInProgress }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[instagram-manual-mode] takeover failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function releaseInstagramConversationAction(
  tenantId: string,
  boundConversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  const conversationId = resolveInstagramActionConversationId(boundConversationId, formData)
  const copy = getInstagramConversationCopy(locale).action
  if (!idSchema.safeParse(tenantId).success || !idSchema.safeParse(conversationId).success) {
    return { ok: false, message: copy.unavailable }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_conversations', 'instagram')
  try {
    const outcome = await releaseInstagramConversation(createAdminClient(), {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    })
    revalidateInstagramPaths(tenantId, conversationId)
    if (outcome === 'released') return success(copy.released)
    if (outcome === 'not_assigned') return { ok: false, message: copy.notAssigned }
    if (outcome === 'send_in_progress') return { ok: false, message: copy.sendInProgress }
    return { ok: false, message: copy.unavailable }
  } catch (error) {
    console.error('[instagram-manual-mode] release failed', { tenantId, conversationId, error })
    return { ok: false, message: copy.unavailable }
  }
}

export async function claimInstagramHandoffAction(
  tenantId: string,
  boundConversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  const conversationId = resolveInstagramActionConversationId(boundConversationId, formData)
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
  boundConversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  const conversationId = resolveInstagramActionConversationId(boundConversationId, formData)
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
    if (result.outcome === 'not_assigned') return { ok: false, message: copy.notAssigned }
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
  boundConversationId: string,
  locale: string,
  _previousState: InstagramHandoffActionState,
  formData: FormData,
): Promise<InstagramHandoffActionState> {
  void _previousState
  const conversationId = resolveInstagramActionConversationId(boundConversationId, formData)
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

export async function createSupervisedFaqFromInstagram(
  tenantId: string,
  conversationId: string,
  assistantMessageId: string,
  locale: string,
  _previousState: InstagramSupervisedFaqState,
  formData: FormData,
): Promise<InstagramSupervisedFaqState> {
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
  const conversationAccess = await requireTenantProductAccess(tenantId, 'view_conversations', 'instagram')
  const admin = createAdminClient()
  const [conversation, { data: theatre }] = await Promise.all([
    getInstagramConversationDetail(admin, {
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
        origin: 'instagram_conversation_supervision',
        origin_channel: 'instagram',
        instagram_conversation_id: conversationId,
        instagram_message_id: message.id,
        approved_at: approvedAt,
      },
    })
    .select('id')
    .single()

  if (insertError || !item) {
    if (insertError?.code === '23505') {
      return { ok: true, message: copy.alreadyCreated, knowledgeItemId: message.id }
    }
    console.error('[instagram-supervision] failed to create FAQ', {
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
      trigger: 'instagram_conversation_supervision',
      instagram_message_id: message.id,
    },
  })
  const publicationStatus = indexed.ok ? 'indexed' : 'pending_index'
  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: theatre?.account_id ?? null,
    theatre_id: tenantId,
    actor_user_id: access.userId,
    action: 'knowledge.faq_created_from_instagram_conversation',
    target_type: 'knowledge_item',
    target_id: item.id,
    metadata: {
      instagram_conversation_id: conversationId,
      instagram_message_id: message.id,
      indexing_status: publicationStatus,
    },
  })
  if (auditError) console.error('[instagram-supervision] failed to audit FAQ', auditError)

  revalidateInstagramPaths(tenantId, conversationId)
  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    message: indexed.ok ? copy.indexed : copy.pendingIndex,
    knowledgeItemId: item.id,
  }
}

function revalidateInstagramPaths(tenantId: string, conversationId: string) {
  revalidatePath(`/${tenantId}/instagram`)
  revalidatePath(`/${tenantId}/instagram/${conversationId}`)
}

function success(message: string): InstagramHandoffActionState {
  return { ok: true, message }
}
