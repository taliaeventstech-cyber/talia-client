import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import {
  extractMetaWhatsappDeliveryStatuses,
  extractMetaWhatsappInboundMessages,
  type MetaWebhookEnvelope,
} from './meta-webhook'

type AdminClient = ReturnType<typeof createAdminClient>

export type WhatsappInboundSummary = {
  received: number
  accepted: number
  duplicates: number
  disabled: number
  handoffs: number
  unmatched: number
  deliveryReceived: number
  deliveryUpdated: number
  deliveryIgnored: number
  deliveryUnmatched: number
}

export async function ingestMetaWhatsappEnvelope(
  admin: AdminClient,
  envelope: MetaWebhookEnvelope,
): Promise<WhatsappInboundSummary> {
  const messages = extractMetaWhatsappInboundMessages(envelope)
  const deliveryStatuses = extractMetaWhatsappDeliveryStatuses(envelope)
  const summary = emptySummary(messages.length, deliveryStatuses.length)

  for (const message of messages) {
    const { data, error } = await admin.rpc('ingest_whatsapp_message', {
      p_waba_id: message.wabaId,
      p_phone_number_id: message.phoneNumberId,
      p_provider_message_id: message.providerMessageId,
      p_sender_wa_id: message.senderWaId,
      p_profile_name: message.profileName ?? '',
      p_message_type: message.messageType,
      p_body_text: message.bodyText ?? '',
      p_provider_timestamp: message.providerTimestamp ?? new Date().toISOString(),
      p_context_provider_message_id: message.contextProviderMessageId ?? '',
      p_processable: message.processable,
      p_metadata: {
        has_context: message.metadata.hasContext,
      } satisfies Json,
    })

    if (error) throw new Error('whatsapp_message_ingest_failed')

    const outcome = data?.[0]?.outcome
    if (outcome === 'accepted') summary.accepted += 1
    else if (outcome === 'duplicate') summary.duplicates += 1
    else if (outcome === 'disabled') summary.disabled += 1
    else if (outcome === 'handoff') summary.handoffs += 1
    else if (outcome === 'unmatched') summary.unmatched += 1
    else throw new Error('whatsapp_message_ingest_invalid_result')
  }

  for (const delivery of deliveryStatuses) {
    const { data, error } = await admin.rpc('reconcile_whatsapp_delivery_status', {
      p_waba_id: delivery.wabaId,
      p_phone_number_id: delivery.phoneNumberId,
      p_provider_message_id: delivery.providerMessageId,
      p_delivery_status: delivery.status,
      p_provider_timestamp: delivery.providerTimestamp ?? new Date().toISOString(),
      p_error_code: delivery.errorCode ?? '',
      p_metadata: delivery.metadata satisfies Json,
    })

    if (error) throw new Error('whatsapp_delivery_status_reconcile_failed')

    const outcome = data?.[0]?.outcome
    if (outcome === 'updated') summary.deliveryUpdated += 1
    else if (outcome === 'duplicate' || outcome === 'stale') summary.deliveryIgnored += 1
    else if (outcome === 'unmatched_connection' || outcome === 'unmatched_message') {
      summary.deliveryUnmatched += 1
    } else {
      throw new Error('whatsapp_delivery_status_reconcile_invalid_result')
    }
  }

  return summary
}

function emptySummary(received: number, deliveryReceived: number): WhatsappInboundSummary {
  return {
    received,
    accepted: 0,
    duplicates: 0,
    disabled: 0,
    handoffs: 0,
    unmatched: 0,
    deliveryReceived,
    deliveryUpdated: 0,
    deliveryIgnored: 0,
    deliveryUnmatched: 0,
  }
}
