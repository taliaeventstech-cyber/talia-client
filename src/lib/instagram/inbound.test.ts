import type { createAdminClient } from '@/lib/supabase/admin'
import { describe, expect, it, vi } from 'vitest'
import { ingestMetaInstagramEnvelope } from './inbound'
import { parseMetaInstagramWebhookEnvelope } from './meta-webhook'

type AdminClient = ReturnType<typeof createAdminClient>

describe('Instagram inbound ingestion', () => {
  it('persists each message through the Instagram-only atomic RPC', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ outcome: 'accepted' }], error: null })
      .mockResolvedValueOnce({ data: [{ outcome: 'duplicate' }], error: null })

    const summary = await ingestMetaInstagramEnvelope(
      { rpc } as unknown as AdminClient,
      inboundEnvelope(),
    )

    expect(summary).toEqual({
      received: 2,
      accepted: 1,
      duplicates: 1,
      disabled: 0,
      handoffs: 0,
      unmatched: 0,
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'ingest_instagram_message', expect.objectContaining({
      p_instagram_user_id: 'professional-account-1',
      p_sender_igsid: 'instagram-scoped-user-1',
      p_provider_message_id: 'instagram-message-1',
      p_processable: true,
    }))
  })

  it('fails the delivery attempt when durable ingestion fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'provider detail must not escape' },
    })

    await expect(ingestMetaInstagramEnvelope(
      { rpc } as unknown as AdminClient,
      inboundEnvelope(),
    )).rejects.toThrow('instagram_message_ingest_failed')
  })
})

function inboundEnvelope() {
  const envelope = parseMetaInstagramWebhookEnvelope(JSON.stringify({
    object: 'instagram',
    entry: [{
      id: 'professional-account-1',
      messaging: [{
        sender: { id: 'instagram-scoped-user-1' },
        recipient: { id: 'professional-account-1' },
        timestamp: 1790053200123,
        message: { mid: 'instagram-message-1', text: 'Hello' },
      }, {
        sender: { id: 'instagram-scoped-user-1' },
        recipient: { id: 'professional-account-1' },
        timestamp: 1790053201123,
        message: { mid: 'instagram-message-2', text: 'Again' },
      }],
    }],
  }))
  if (!envelope) throw new Error('Invalid Instagram test envelope')
  return envelope
}
