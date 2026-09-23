import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import {
  extractMetaInstagramInboundMessages,
  type MetaInstagramWebhookEnvelope,
} from './meta-webhook'

type AdminClient = ReturnType<typeof createAdminClient>

export type InstagramInboundSummary = {
  received: number
  accepted: number
  duplicates: number
  disabled: number
  handoffs: number
  unmatched: number
}

export async function ingestMetaInstagramEnvelope(
  admin: AdminClient,
  envelope: MetaInstagramWebhookEnvelope,
): Promise<InstagramInboundSummary> {
  const messages = extractMetaInstagramInboundMessages(envelope)
  const summary: InstagramInboundSummary = {
    received: messages.length,
    accepted: 0,
    duplicates: 0,
    disabled: 0,
    handoffs: 0,
    unmatched: 0,
  }

  for (const message of messages) {
    const { data, error } = await admin.rpc('ingest_instagram_message', {
      p_instagram_user_id: message.instagramUserId,
      p_sender_igsid: message.senderInstagramScopedId,
      p_provider_message_id: message.providerMessageId,
      p_message_type: message.messageType,
      p_body_text: message.bodyText ?? '',
      p_provider_timestamp: message.providerTimestamp ?? new Date().toISOString(),
      p_context_provider_message_id: message.contextProviderMessageId ?? '',
      p_processable: message.processable,
      p_metadata: {
        has_attachments: message.metadata.hasAttachments,
        has_reply_context: message.metadata.hasReplyContext,
        is_unsupported: message.metadata.isUnsupported,
      } satisfies Json,
    })

    if (error) throw new Error('instagram_message_ingest_failed')

    const result = data?.[0]
    const outcome = result?.outcome
    if (outcome === 'accepted' && result.inbound_job_id === null) summary.handoffs += 1
    else if (outcome === 'accepted') summary.accepted += 1
    else if (outcome === 'duplicate') summary.duplicates += 1
    else if (outcome === 'disabled') summary.disabled += 1
    else if (outcome === 'handoff') summary.handoffs += 1
    else if (outcome === 'unmatched') summary.unmatched += 1
    else throw new Error('instagram_message_ingest_invalid_result')
  }

  return summary
}
