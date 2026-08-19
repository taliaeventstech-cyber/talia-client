import type { createAdminClient } from '@/lib/supabase/admin'
import { describe, expect, it, vi } from 'vitest'
import { parseMetaWebhookEnvelope } from './meta-webhook'
import { ingestMetaWhatsappEnvelope } from './inbound'

type AdminClient = ReturnType<typeof createAdminClient>

describe('WhatsApp inbound ingestion', () => {
  it('persists each inbound message through the atomic ingestion RPC', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ outcome: 'accepted' }], error: null })
      .mockResolvedValueOnce({ data: [{ outcome: 'duplicate' }], error: null })
    const envelope = inboundEnvelope()

    const summary = await ingestMetaWhatsappEnvelope({ rpc } as unknown as AdminClient, envelope)

    expect(summary).toEqual({
      received: 2,
      accepted: 1,
      duplicates: 1,
      disabled: 0,
      handoffs: 0,
      unmatched: 0,
      deliveryReceived: 0,
      deliveryUpdated: 0,
      deliveryIgnored: 0,
      deliveryUnmatched: 0,
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'ingest_whatsapp_message', expect.objectContaining({
      p_waba_id: 'waba-1',
      p_phone_number_id: 'phone-1',
      p_provider_message_id: 'message-1',
      p_sender_wa_id: '34123456789',
      p_processable: true,
    }))
  })

  it('reconciles delivery updates through the tenant-scoped RPC', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ outcome: 'updated' }], error: null })
      .mockResolvedValueOnce({ data: [{ outcome: 'stale' }], error: null })
    const envelope = parseEnvelope({
      metadata: { phone_number_id: 'phone-1' },
      statuses: [
        { id: 'outbound-1', status: 'read', timestamp: '1786723200' },
        { id: 'outbound-2', status: 'sent', timestamp: '1786723199' },
      ],
    })

    await expect(ingestMetaWhatsappEnvelope({ rpc } as unknown as AdminClient, envelope))
      .resolves.toEqual({
        received: 0,
        accepted: 0,
        duplicates: 0,
        disabled: 0,
        handoffs: 0,
        unmatched: 0,
        deliveryReceived: 2,
        deliveryUpdated: 1,
        deliveryIgnored: 1,
        deliveryUnmatched: 0,
      })
    expect(rpc).toHaveBeenNthCalledWith(1, 'reconcile_whatsapp_delivery_status', {
      p_waba_id: 'waba-1',
      p_phone_number_id: 'phone-1',
      p_provider_message_id: 'outbound-1',
      p_delivery_status: 'read',
      p_provider_timestamp: '2026-08-14T16:00:00.000Z',
      p_error_code: '',
      p_metadata: {},
    })
  })

  it('fails the webhook attempt when durable ingestion fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'provider details must not escape' },
    })

    await expect(ingestMetaWhatsappEnvelope(
      { rpc } as unknown as AdminClient,
      inboundEnvelope(),
    )).rejects.toThrow('whatsapp_message_ingest_failed')
  })
})

function inboundEnvelope() {
  return parseEnvelope({
    metadata: { phone_number_id: 'phone-1' },
    contacts: [{ wa_id: '34123456789', profile: { name: 'Ada' } }],
    messages: [
      {
        id: 'message-1',
        from: '34123456789',
        timestamp: '1786723200',
        type: 'text',
        text: { body: 'Hello' },
      },
      {
        id: 'message-2',
        from: '34123456789',
        timestamp: '1786723201',
        type: 'text',
        text: { body: 'Again' },
      },
    ],
  })
}

function parseEnvelope(value: Record<string, unknown>) {
  const envelope = parseMetaWebhookEnvelope(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      changes: [{ field: 'messages', value }],
    }],
  }))

  if (!envelope) throw new Error('Invalid test envelope')
  return envelope
}
