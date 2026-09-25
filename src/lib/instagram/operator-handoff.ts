import type { createAdminClient } from '@/lib/supabase/admin'
import { recordUsageEvent } from '@/lib/usage/service'
import { z } from 'zod'
import { getInstagramConnectionAccessToken } from './credentials'
import { sendMetaInstagramText, type MetaInstagramSendResult } from './meta-client'

type AdminClient = ReturnType<typeof createAdminClient>

const preparedReplySchema = z.object({
  state: z.literal('prepared'),
  outbound_message_id: z.uuid(),
  instagram_user_id: z.string().min(1),
  recipient_igsid: z.string().min(1),
  body_text: z.string().min(1).max(1_000),
  use_human_agent_tag: z.boolean(),
})
const existingReplySchema = z.object({
  state: z.literal('existing'),
  outbound_message_id: z.uuid(),
  delivery_status: z.string().nullable(),
})

export async function claimInstagramHandoff(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await callInstagramRpc(admin, 'claim_instagram_handoff', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`instagram_handoff_claim_failed:${result.error.message}`)
  return typeof result.data === 'string' ? result.data : 'unavailable'
}

export async function ignoreInstagramHandoff(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await callInstagramRpc(admin, 'ignore_instagram_handoff', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`instagram_handoff_ignore_failed:${result.error.message}`)
  return typeof result.data === 'string' ? result.data : 'unavailable'
}

export async function takeOverInstagramConversation(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await callInstagramRpc(admin, 'take_over_instagram_conversation', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`instagram_conversation_takeover_failed:${result.error.message}`)
  return typeof result.data === 'string' ? result.data : 'unavailable'
}

export async function releaseInstagramConversation(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await callInstagramRpc(admin, 'release_instagram_conversation', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`instagram_conversation_release_failed:${result.error.message}`)
  return typeof result.data === 'string' ? result.data : 'unavailable'
}

export type SendInstagramOperatorReplyResult =
  | { outcome: 'sent' | 'already_sent'; outboundMessageId: string }
  | {
      outcome:
        | 'unavailable'
        | 'not_assigned'
        | 'connection_unavailable'
        | 'conversation_context_missing'
        | 'human_agent_window_expired'
    }
  | { outcome: 'failed' | 'uncertain'; outboundMessageId: string; errorCode: string }

export async function sendInstagramOperatorReply(
  admin: AdminClient,
  input: {
    tenantId: string
    conversationId: string
    actorUserId: string
    body: string
    idempotencyKey: string
  },
  options: {
    send?: typeof sendMetaInstagramText
    recordUsage?: typeof recordUsageEvent
    resolveAccessToken?: typeof getInstagramConnectionAccessToken
  } = {},
): Promise<SendInstagramOperatorReplyResult> {
  const preparedResult = await callInstagramRpc(admin, 'prepare_instagram_operator_reply', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
    p_body_text: input.body,
    p_idempotency_key: input.idempotencyKey,
  })
  if (preparedResult.error) {
    throw new Error(`instagram_operator_reply_prepare_failed:${preparedResult.error.message}`)
  }

  const existing = existingReplySchema.safeParse(preparedResult.data)
  if (existing.success) {
    if (['sent', 'delivered', 'read'].includes(existing.data.delivery_status ?? '')) {
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
    if (
      state === 'not_assigned'
      || state === 'connection_unavailable'
      || state === 'conversation_context_missing'
      || state === 'human_agent_window_expired'
    ) {
      return { outcome: state }
    }
    return { outcome: 'unavailable' }
  }

  const prepared = preparedReplySchema.parse(preparedResult.data)
  const start = await callInstagramRpc(admin, 'start_instagram_operator_reply_send', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_outbound_message_id: prepared.outbound_message_id,
    p_actor_user_id: input.actorUserId,
  })
  if (start.error) throw new Error(`instagram_operator_reply_start_failed:${start.error.message}`)
  if (start.data !== 'started') {
    return {
      outcome: 'uncertain',
      outboundMessageId: prepared.outbound_message_id,
      errorCode: `send_${String(start.data ?? 'unavailable')}`,
    }
  }

  let accessToken: string
  try {
    accessToken = await (options.resolveAccessToken ?? getInstagramConnectionAccessToken)(admin, {
      tenantId: input.tenantId,
      instagramUserId: prepared.instagram_user_id,
    })
  } catch {
    return finalizeOperatorReply(admin, input, prepared.outbound_message_id, {
      ok: false,
      outcome: 'definitive_rejection',
      status: null,
      errorCode: 'instagram_connection_credentials_unavailable',
    }, options.recordUsage ?? recordUsageEvent)
  }

  let providerResult: MetaInstagramSendResult
  try {
    providerResult = await (options.send ?? sendMetaInstagramText)({
      instagramUserId: prepared.instagram_user_id,
      recipientInstagramScopedId: prepared.recipient_igsid,
      body: prepared.body_text,
      messagingType: prepared.use_human_agent_tag ? 'human_agent' : 'response',
    }, { accessToken })
  } catch {
    providerResult = {
      ok: false,
      outcome: 'uncertain',
      status: null,
      errorCode: 'meta_instagram_network_outcome_unknown',
    }
  }

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
  providerResult: MetaInstagramSendResult,
  recordUsage: typeof recordUsageEvent,
): Promise<SendInstagramOperatorReplyResult> {
  if (providerResult.ok) {
    const completed = await callInstagramRpc(admin, 'complete_instagram_operator_reply', {
      p_theatre_id: input.tenantId,
      p_conversation_id: input.conversationId,
      p_outbound_message_id: outboundMessageId,
      p_actor_user_id: input.actorUserId,
      p_provider_message_id: providerResult.providerMessageId,
    })
    if (completed.error || completed.data !== true) {
      throw new Error('instagram_operator_reply_complete_failed')
    }

    const usage = await recordUsage(admin, {
      tenantId: input.tenantId,
      moduleKey: 'instagram',
      channel: 'instagram',
      eventType: 'message',
      unit: 'message',
      idempotencyKey: `instagram:${outboundMessageId}:outbound`,
      metadata: {
        direction: 'outbound',
        origin: 'operator_handoff',
        conversation_id: input.conversationId,
        attention_event: 'response_completed',
      },
    })
    if (!usage.ok) {
      console.error('[instagram-handoff] failed to record manual outbound usage', {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        outboundMessageId,
        error: usage.error,
      })
    }
    return { outcome: 'sent', outboundMessageId }
  }

  const deliveryStatus = providerResult.outcome === 'uncertain' ? 'unknown' : 'failed'
  const failed = await callInstagramRpc(admin, 'fail_instagram_operator_reply', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_outbound_message_id: outboundMessageId,
    p_actor_user_id: input.actorUserId,
    p_delivery_status: deliveryStatus,
    p_error_code: providerResult.errorCode,
  })
  if (failed.error || failed.data !== true) {
    throw new Error('instagram_operator_reply_failure_persist_failed')
  }
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

function callInstagramRpc(admin: AdminClient, name: string, args: Record<string, unknown>) {
  const rpc = admin.rpc as unknown as (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  return rpc(name, args)
}
