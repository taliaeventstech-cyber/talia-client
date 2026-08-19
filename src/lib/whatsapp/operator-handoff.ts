import type { createAdminClient } from '@/lib/supabase/admin'
import { recordUsageEvent } from '@/lib/usage/service'
import { sendMetaWhatsappText, type MetaWhatsappSendResult } from './meta-client'
import { z } from 'zod'

type AdminClient = ReturnType<typeof createAdminClient>

const nullableString = z.string().nullable()
const queueItemSchema = z.object({
  id: z.uuid(),
  contact_name: z.string(),
  contact_masked: z.string(),
  last_message_at: nullableString,
  created_at: z.string(),
  handoff_reason: nullableString,
  assigned_profile_id: z.uuid().nullable(),
  assigned_name: nullableString,
  assigned_email: nullableString,
  message_count: z.number().int().nonnegative(),
  latest_message: nullableString,
  latest_direction: z.enum(['inbound', 'outbound']).nullable(),
})
const queueSchema = z.object({
  items: z.array(queueItemSchema),
  count: z.number().int().nonnegative(),
})
const historySchema = z.object({
  items: z.array(queueItemSchema.extend({
    status: z.enum(['open', 'pending', 'handoff', 'resolved', 'blocked']),
  })),
  count: z.number().int().nonnegative(),
})

const messageSchema = z.object({
  id: z.uuid(),
  direction: z.enum(['inbound', 'outbound']),
  message_type: z.string(),
  body_text: nullableString,
  created_at: z.string(),
  delivery_status: nullableString,
  processing_status: z.string(),
  is_operator_reply: z.boolean(),
})
const detailSchema = z.object({
  id: z.uuid(),
  status: z.enum(['open', 'pending', 'handoff', 'resolved', 'blocked']),
  contact_name: z.string(),
  contact_masked: z.string(),
  handoff_reason: nullableString,
  created_at: z.string(),
  last_message_at: nullableString,
  assigned_profile_id: z.uuid().nullable(),
  assigned_name: nullableString,
  assigned_email: nullableString,
  messages: z.array(messageSchema),
})

const preparedReplySchema = z.object({
  state: z.literal('prepared'),
  outbound_message_id: z.uuid(),
  phone_number_id: z.string().min(1),
  recipient_wa_id: z.string().min(1),
  reply_to_provider_message_id: z.string().min(1),
  body_text: z.string().min(1).max(4096),
})
const existingReplySchema = z.object({
  state: z.literal('existing'),
  outbound_message_id: z.uuid(),
  delivery_status: nullableString,
})

export type WhatsappHandoffQueueItem = z.infer<typeof queueItemSchema>
export type WhatsappHandoffDetail = z.infer<typeof detailSchema>

export async function getWhatsappHandoffQueue(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string; limit?: number },
) {
  const result = await admin.rpc('get_whatsapp_handoff_queue', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_limit: input.limit ?? 100,
  })
  if (result.error) throw new Error(`whatsapp_handoff_queue_failed:${result.error.message}`)

  const parsed = queueSchema.safeParse(result.data)
  if (!parsed.success) throw new Error('whatsapp_handoff_queue_invalid')
  return parsed.data
}

export async function getWhatsappConversationHistory(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string; limit?: number },
) {
  const result = await admin.rpc('get_whatsapp_conversation_history', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_limit: input.limit ?? 100,
  })
  if (result.error) throw new Error(`whatsapp_conversation_history_failed:${result.error.message}`)

  const parsed = historySchema.safeParse(result.data)
  if (!parsed.success) throw new Error('whatsapp_conversation_history_invalid')
  return parsed.data
}

export async function getWhatsappHandoffDetail(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await admin.rpc('get_whatsapp_handoff_detail', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`whatsapp_handoff_detail_failed:${result.error.message}`)
  if (result.data === null) return null

  const parsed = detailSchema.safeParse(result.data)
  if (!parsed.success) throw new Error('whatsapp_handoff_detail_invalid')
  return parsed.data
}

export async function claimWhatsappHandoff(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await admin.rpc('claim_whatsapp_handoff', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`whatsapp_handoff_claim_failed:${result.error.message}`)
  return result.data
}

export async function ignoreWhatsappHandoff(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await admin.rpc('ignore_whatsapp_handoff', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`whatsapp_handoff_ignore_failed:${result.error.message}`)
  return result.data
}

export type SendWhatsappOperatorReplyResult =
  | { outcome: 'sent'; outboundMessageId: string }
  | { outcome: 'already_sent'; outboundMessageId: string }
  | { outcome: 'unavailable' | 'not_assigned' | 'connection_unavailable' | 'conversation_context_missing' }
  | { outcome: 'failed' | 'uncertain'; outboundMessageId: string; errorCode: string }

export async function sendWhatsappOperatorReply(
  admin: AdminClient,
  input: {
    tenantId: string
    conversationId: string
    actorUserId: string
    body: string
    idempotencyKey: string
  },
  options: {
    send?: typeof sendMetaWhatsappText
    recordUsage?: typeof recordUsageEvent
  } = {},
): Promise<SendWhatsappOperatorReplyResult> {
  const preparedResult = await admin.rpc('prepare_whatsapp_operator_reply', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
    p_body_text: input.body,
    p_idempotency_key: input.idempotencyKey,
  })
  if (preparedResult.error) throw new Error(`whatsapp_operator_reply_prepare_failed:${preparedResult.error.message}`)

  const existing = existingReplySchema.safeParse(preparedResult.data)
  if (existing.success) {
    const confirmed = ['sent', 'delivered', 'read'].includes(existing.data.delivery_status ?? '')
    if (confirmed) {
      return { outcome: 'already_sent', outboundMessageId: existing.data.outbound_message_id }
    }
    return {
      outcome: 'uncertain',
      outboundMessageId: existing.data.outbound_message_id,
      errorCode: 'operator_reply_already_prepared',
    }
  }

  const state = getState(preparedResult.data)
  if (state !== 'prepared') {
    if (state === 'not_assigned' || state === 'connection_unavailable' || state === 'conversation_context_missing') {
      return { outcome: state }
    }
    return { outcome: 'unavailable' }
  }

  const prepared = preparedReplySchema.parse(preparedResult.data)
  const start = await admin.rpc('start_whatsapp_operator_reply_send', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_outbound_message_id: prepared.outbound_message_id,
    p_actor_user_id: input.actorUserId,
  })
  if (start.error) throw new Error(`whatsapp_operator_reply_start_failed:${start.error.message}`)
  if (start.data !== 'started') {
    return { outcome: 'uncertain', outboundMessageId: prepared.outbound_message_id, errorCode: `send_${start.data}` }
  }

  const providerResult = await (options.send ?? sendMetaWhatsappText)({
    phoneNumberId: prepared.phone_number_id,
    recipientWaId: prepared.recipient_wa_id,
    body: prepared.body_text,
    replyToProviderMessageId: prepared.reply_to_provider_message_id,
  })
  return finalizeOperatorReply(
    admin,
    input,
    prepared.outbound_message_id,
    providerResult,
    options.recordUsage ?? recordUsageEvent,
  )
}

async function finalizeOperatorReply(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
  outboundMessageId: string,
  providerResult: MetaWhatsappSendResult,
  recordUsage: typeof recordUsageEvent,
): Promise<SendWhatsappOperatorReplyResult> {
  if (providerResult.ok) {
    const completed = await admin.rpc('complete_whatsapp_operator_reply', {
      p_theatre_id: input.tenantId,
      p_conversation_id: input.conversationId,
      p_outbound_message_id: outboundMessageId,
      p_actor_user_id: input.actorUserId,
      p_provider_message_id: providerResult.providerMessageId,
    })
    if (completed.error || completed.data !== true) throw new Error('whatsapp_operator_reply_complete_failed')

    const usage = await recordUsage(admin, {
      tenantId: input.tenantId,
      moduleKey: 'whatsapp',
      channel: 'whatsapp',
      eventType: 'message',
      unit: 'message',
      idempotencyKey: `whatsapp:${outboundMessageId}:outbound`,
      metadata: {
        direction: 'outbound',
        origin: 'operator_handoff',
        conversation_id: input.conversationId,
        attention_event: 'response_completed',
      },
    })
    if (!usage.ok) {
      console.error('[whatsapp-handoff] failed to record manual outbound usage', {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        outboundMessageId,
        error: usage.error,
      })
    }
    return { outcome: 'sent', outboundMessageId }
  }

  const deliveryStatus = providerResult.outcome === 'uncertain' ? 'unknown' : 'failed'
  const failed = await admin.rpc('fail_whatsapp_operator_reply', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_outbound_message_id: outboundMessageId,
    p_actor_user_id: input.actorUserId,
    p_delivery_status: deliveryStatus,
    p_error_code: providerResult.errorCode,
  })
  if (failed.error || failed.data !== true) throw new Error('whatsapp_operator_reply_failure_persist_failed')
  return {
    outcome: providerResult.outcome === 'uncertain' ? 'uncertain' : 'failed',
    outboundMessageId,
    errorCode: providerResult.errorCode,
  }
}

function getState(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return typeof (value as { state?: unknown }).state === 'string'
    ? (value as { state: string }).state
    : null
}
