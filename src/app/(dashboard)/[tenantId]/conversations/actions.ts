'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import {
  getConversationResponseReview,
  mergeAcceptedResponseReviewMetadata,
} from '@/lib/chat/supervised-learning'
import {
  getOrCreateManualKnowledgeSource,
  reindexStructuredKnowledgeSource,
} from '@/lib/knowledge/ingestion'
import { getSupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'
import type { Json } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type SupervisedFaqState = {
  ok: boolean
  message: string
  knowledgeItemId?: string
}

const supervisedFaqSchema = z.object({
  question: z.string().trim().min(4, 'La pregunta debe tener al menos 4 caracteres.').max(500),
  answer: z.string().trim().min(4, 'La respuesta debe tener al menos 4 caracteres.').max(4_000),
})

export async function createSupervisedFaqFromConversation(
  tenantId: string,
  conversationId: string,
  assistantMessageId: string,
  locale: string,
  _previousState: SupervisedFaqState,
  formData: FormData,
): Promise<SupervisedFaqState> {
  void _previousState
  const access = await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const copy = getSupervisedFaqCopy(locale).action
  const parsed = supervisedFaqSchema.safeParse({
    question: formData.get('question'),
    answer: formData.get('answer'),
  })
  if (!parsed.success) {
    return { ok: false, message: copy.invalid }
  }

  const admin = createAdminClient()
  const [{ data: message, error: messageError }, { data: conversation }, { data: theatre }] = await Promise.all([
    admin
      .from('messages')
      .select('id, conversation_id, metadata')
      .eq('id', assistantMessageId)
      .eq('conversation_id', conversationId)
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant')
      .maybeSingle(),
    admin
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('theatre_id', tenantId)
      .maybeSingle(),
    admin
      .from('theatres')
      .select('account_id')
      .eq('id', tenantId)
      .maybeSingle(),
  ])

  if (messageError) {
    console.error('[conversation-supervision] failed to load assistant message', {
      tenantId,
      conversationId,
      assistantMessageId,
      error: messageError.message,
    })
    return { ok: false, message: copy.unavailable }
  }
  if (!message || !conversation) return { ok: false, message: copy.unavailable }

  const review = getConversationResponseReview(message.metadata)
  if (review.humanReviewStatus === 'accepted_valid') {
    return { ok: true, message: copy.alreadyAccepted }
  }
  if (!review.eligibleForCorrection) {
    return {
      ok: false,
      message: copy.notEligible,
    }
  }

  const existingKnowledgeItem = await admin
    .from('knowledge_items')
    .select('id')
    .eq('id', message.id)
    .eq('theatre_id', tenantId)
    .maybeSingle()
  if (existingKnowledgeItem.data) {
    return {
      ok: true,
      message: copy.alreadyCreated,
      knowledgeItemId: existingKnowledgeItem.data.id,
    }
  }

  const source = await getOrCreateManualKnowledgeSource({ admin, tenantId })
  if (!source.ok) {
    console.error('[conversation-supervision] failed to prepare manual knowledge source', {
      tenantId,
      conversationId,
      assistantMessageId,
      error: source.message,
    })
    return { ok: false, message: copy.sourceError }
  }

  const approvedAt = new Date().toISOString()
  const originalAction = getAgentAction(message.metadata)
  const { data: item, error: insertError } = await admin
    .from('knowledge_items')
    .insert({
      id: message.id,
      theatre_id: tenantId,
      source_id: source.sourceId,
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: 'Aprendizaje supervisado',
      // Source-language metadata must never dictate TALIA's response language.
      // The latest visitor message remains authoritative at answer time.
      language: 'und',
      priority: 80,
      active: true,
      metadata: {
        origin: 'conversation_supervision',
        conversation_id: conversationId,
        assistant_message_id: message.id,
        original_rating: review.rating,
        original_action: originalAction,
        approved_at: approvedAt,
      },
    })
    .select('id')
    .single()

  if (insertError || !item) {
    if (insertError?.code === '23505') {
      return {
        ok: true,
        message: copy.alreadyCreated,
        knowledgeItemId: message.id,
      }
    }
    console.error('[conversation-supervision] failed to create FAQ', {
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
      trigger: 'conversation_supervision',
      assistant_message_id: message.id,
    },
  })
  const publicationStatus = indexed.ok ? 'indexed' : 'pending_index'
  const updatedMetadata = mergeSupervisedLearningMetadata(message.metadata, {
    knowledgeItemId: item.id,
    status: publicationStatus,
    approvedAt,
  })
  const { error: messageUpdateError } = await admin
    .from('messages')
    .update({ metadata: updatedMetadata })
    .eq('id', message.id)
    .eq('theatre_id', tenantId)

  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: theatre?.account_id ?? null,
    theatre_id: tenantId,
    actor_user_id: access.userId,
    action: 'knowledge.faq_created_from_conversation',
    target_type: 'knowledge_item',
    target_id: item.id,
    metadata: {
      conversation_id: conversationId,
      assistant_message_id: message.id,
      original_rating: review.rating,
      original_action: originalAction,
      indexing_status: publicationStatus,
    },
  })

  if (messageUpdateError) {
    console.error('[conversation-supervision] failed to link FAQ to assistant message', {
      tenantId,
      conversationId,
      assistantMessageId,
      knowledgeItemId: item.id,
      error: messageUpdateError.message,
    })
  }
  if (auditError) {
    console.error('[conversation-supervision] failed to record audit event', {
      tenantId,
      conversationId,
      assistantMessageId,
      knowledgeItemId: item.id,
      error: auditError.message,
    })
  }

  revalidatePath(`/${tenantId}/conversations/${conversationId}`)
  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    message: indexed.ok ? copy.indexed : copy.pendingIndex,
    knowledgeItemId: item.id,
  }
}

export async function acceptConversationResponse(
  tenantId: string,
  conversationId: string,
  assistantMessageId: string,
  locale: string,
  _previousState: SupervisedFaqState,
  _formData: FormData,
): Promise<SupervisedFaqState> {
  void _previousState
  void _formData
  const access = await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const copy = getSupervisedFaqCopy(locale).action
  const admin = createAdminClient()
  const [{ data: message, error: messageError }, { data: theatre }] = await Promise.all([
    admin
      .from('messages')
      .select('id, metadata')
      .eq('id', assistantMessageId)
      .eq('conversation_id', conversationId)
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant')
      .maybeSingle(),
    admin
      .from('theatres')
      .select('account_id')
      .eq('id', tenantId)
      .maybeSingle(),
  ])

  if (messageError) {
    console.error('[conversation-supervision] failed to load response for validation', {
      tenantId,
      conversationId,
      assistantMessageId,
      error: messageError.message,
    })
    return { ok: false, message: copy.unavailable }
  }
  if (!message) return { ok: false, message: copy.unavailable }

  const review = getConversationResponseReview(message.metadata)
  if (review.humanReviewStatus === 'accepted_valid') {
    return { ok: true, message: copy.alreadyAccepted }
  }
  if (!review.eligibleForCorrection) {
    return { ok: false, message: copy.notEligible }
  }

  const { data: existingKnowledgeItem } = await admin
    .from('knowledge_items')
    .select('id')
    .eq('id', message.id)
    .eq('theatre_id', tenantId)
    .maybeSingle()
  if (existingKnowledgeItem) {
    return {
      ok: true,
      message: copy.alreadyCreated,
      knowledgeItemId: existingKnowledgeItem.id,
    }
  }

  const reviewedAt = new Date().toISOString()
  const updatedMetadata = mergeAcceptedResponseReviewMetadata(message.metadata, {
    reviewerUserId: access.userId,
    reviewedAt,
  })
  const { error: updateError } = await admin
    .from('messages')
    .update({ metadata: updatedMetadata })
    .eq('id', message.id)
    .eq('conversation_id', conversationId)
    .eq('theatre_id', tenantId)

  if (updateError) {
    console.error('[conversation-supervision] failed to validate response', {
      tenantId,
      conversationId,
      assistantMessageId,
      error: updateError.message,
    })
    return { ok: false, message: copy.acceptError }
  }

  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: theatre?.account_id ?? null,
    theatre_id: tenantId,
    actor_user_id: access.userId,
    action: 'conversation.response_accepted_as_valid',
    target_type: 'message',
    target_id: message.id,
    metadata: {
      conversation_id: conversationId,
      assistant_message_id: message.id,
      original_rating: review.rating,
      original_reason: review.reason,
      reviewed_at: reviewedAt,
    },
  })
  if (auditError) {
    console.error('[conversation-supervision] failed to audit response validation', {
      tenantId,
      conversationId,
      assistantMessageId,
      error: auditError.message,
    })
  }

  revalidatePath(`/${tenantId}/conversations`)
  revalidatePath(`/${tenantId}/conversations/${conversationId}`)
  return { ok: true, message: copy.accepted }
}

export async function deleteConversation(
  tenantId: string,
  conversationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireTenantProductAccess(tenantId, 'delete_conversations', 'chatbot')

  const admin = createAdminClient()

  // Fetch session_id to clean up conversation_topics
  const [{ data: conversation }, { data: theatre }] = await Promise.all([
    admin
      .from('conversations')
      .select('session_id')
      .eq('id', conversationId)
      .eq('theatre_id', tenantId)
      .single(),
    admin
      .from('theatres')
      .select('account_id')
      .eq('id', tenantId)
      .maybeSingle(),
  ])

  if (!conversation) return { ok: false, error: 'Conversación no encontrada.' }

  // Delete associated topics
  await admin
    .from('conversation_topics')
    .delete()
    .eq('theatre_id', tenantId)
    .eq('session_id', conversation.session_id)

  // Delete conversation (messages cascade via DB constraint)
  const { error } = await admin
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('theatre_id', tenantId)

  if (error) return { ok: false, error: error.message }

  const { error: usageAnonymizationError } = await admin.rpc('anonymize_chatbot_usage_identifiers', {
    p_theatre_id: tenantId,
    p_session_id: conversation.session_id,
  })
  if (usageAnonymizationError) {
    console.error('[conversation-deletion] failed to anonymize retained usage identifiers', {
      tenantId,
      conversationId,
      error: usageAnonymizationError.message,
    })
  }

  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: theatre?.account_id ?? null,
    theatre_id: tenantId,
    actor_user_id: access.userId,
    action: 'conversation.deleted_by_customer',
    target_type: 'conversation',
    target_id: conversationId,
    metadata: {
      content_deleted: true,
      usage_retained: true,
    },
  })
  if (auditError) {
    console.error('[conversation-deletion] failed to audit customer deletion', {
      tenantId,
      conversationId,
      error: auditError.message,
    })
  }

  revalidatePath(`/${tenantId}/conversations`)
  return { ok: true }
}

function mergeSupervisedLearningMetadata(
  metadata: Json,
  input: {
    knowledgeItemId: string
    status: 'indexed' | 'pending_index'
    approvedAt: string
  },
) {
  const base = isRecord(metadata) ? metadata : {}
  return {
    ...base,
    supervised_learning: {
      knowledge_item_id: input.knowledgeItemId,
      status: input.status,
      approved_at: input.approvedAt,
    },
  } satisfies Record<string, Json>
}

function getAgentAction(metadata: Json) {
  if (!isRecord(metadata) || !isRecord(metadata.agent_metadata)) return null
  const action = metadata.agent_metadata.action
  return typeof action === 'string' ? action.slice(0, 80) : null
}

function isRecord(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
