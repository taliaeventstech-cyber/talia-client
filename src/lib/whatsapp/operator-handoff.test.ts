import { describe, expect, it, vi } from 'vitest'
import {
  getWhatsappHandoffDetail,
  getWhatsappHandoffQueue,
  sendWhatsappOperatorReply,
} from './operator-handoff'

function createRpcAdmin(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  return {
    rpc: vi.fn().mockImplementation(async () => responses.shift() ?? { data: null, error: null }),
  }
}

describe('WhatsApp operator handoff', () => {
  it('parses a masked tenant queue without requiring raw contact identifiers', async () => {
    const admin = createRpcAdmin([{
      data: {
        count: 1,
        items: [{
          id: 'b1000000-0000-4000-8000-000000000001',
          contact_name: 'Alex',
          contact_masked: '•••• 6789',
          last_message_at: '2026-08-17T12:00:00Z',
          created_at: '2026-08-17T11:00:00Z',
          handoff_reason: 'low_confidence',
          assigned_profile_id: null,
          assigned_name: null,
          assigned_email: null,
          message_count: 3,
          latest_message: 'Necesito ayuda',
          latest_direction: 'inbound',
        }],
      },
      error: null,
    }])

    const queue = await getWhatsappHandoffQueue(admin as never, {
      tenantId: 'b2000000-0000-0000-0000-000000000001',
      actorUserId: 'b3000000-0000-0000-0000-000000000001',
    })

    expect(queue.items[0].contact_masked).toBe('•••• 6789')
    expect(JSON.stringify(queue)).not.toContain('34123456789')
  })

  it('returns null when a tenant-scoped conversation is absent', async () => {
    const admin = createRpcAdmin([{ data: null, error: null }])

    await expect(getWhatsappHandoffDetail(admin as never, {
      tenantId: 'b2000000-0000-0000-0000-000000000001',
      conversationId: 'b1000000-0000-4000-8000-000000000001',
      actorUserId: 'b3000000-0000-0000-0000-000000000001',
    })).resolves.toBeNull()
  })

  it('persists, starts and confirms one operator reply before recording usage', async () => {
    const admin = createRpcAdmin([
      {
        data: {
          state: 'prepared',
          outbound_message_id: 'b4000000-0000-4000-8000-000000000001',
          phone_number_id: 'phone-id',
          recipient_wa_id: '34123456789',
          reply_to_provider_message_id: 'wamid.inbound',
          body_text: 'Respuesta humana',
        },
        error: null,
      },
      { data: 'started', error: null },
      { data: true, error: null },
    ])
    const send = vi.fn().mockResolvedValue({ ok: true, providerMessageId: 'wamid.outbound' })
    const recordUsage = vi.fn().mockResolvedValue({ ok: true })

    const result = await sendWhatsappOperatorReply(admin as never, {
      tenantId: 'b2000000-0000-0000-0000-000000000001',
      conversationId: 'b1000000-0000-4000-8000-000000000001',
      actorUserId: 'b3000000-0000-0000-0000-000000000001',
      body: 'Respuesta humana',
      idempotencyKey: 'b5000000-0000-0000-0000-000000000001',
    }, { send, recordUsage: recordUsage as never })

    expect(result).toEqual({ outcome: 'sent', outboundMessageId: 'b4000000-0000-4000-8000-000000000001' })
    expect(send).toHaveBeenCalledOnce()
    expect(admin.rpc).toHaveBeenNthCalledWith(3, 'complete_whatsapp_operator_reply', expect.objectContaining({
      p_provider_message_id: 'wamid.outbound',
    }))
    expect(recordUsage).toHaveBeenCalledWith(admin, expect.objectContaining({
      channel: 'whatsapp',
      idempotencyKey: 'whatsapp:b4000000-0000-4000-8000-000000000001:outbound',
    }))
  })

  it('persists an uncertain Meta outcome and never retries automatically', async () => {
    const admin = createRpcAdmin([
      {
        data: {
          state: 'prepared',
          outbound_message_id: 'b4000000-0000-4000-8000-000000000001',
          phone_number_id: 'phone-id',
          recipient_wa_id: '34123456789',
          reply_to_provider_message_id: 'wamid.inbound',
          body_text: 'Respuesta humana',
        },
        error: null,
      },
      { data: 'started', error: null },
      { data: true, error: null },
    ])
    const send = vi.fn().mockResolvedValue({
      ok: false,
      outcome: 'uncertain',
      status: null,
      errorCode: 'meta_network_outcome_unknown',
    })

    const result = await sendWhatsappOperatorReply(admin as never, {
      tenantId: 'b2000000-0000-0000-0000-000000000001',
      conversationId: 'b1000000-0000-4000-8000-000000000001',
      actorUserId: 'b3000000-0000-0000-0000-000000000001',
      body: 'Respuesta humana',
      idempotencyKey: 'b5000000-0000-0000-0000-000000000001',
    }, { send })

    expect(result).toEqual({
      outcome: 'uncertain',
      outboundMessageId: 'b4000000-0000-4000-8000-000000000001',
      errorCode: 'meta_network_outcome_unknown',
    })
    expect(send).toHaveBeenCalledOnce()
    expect(admin.rpc).toHaveBeenNthCalledWith(3, 'fail_whatsapp_operator_reply', expect.objectContaining({
      p_delivery_status: 'unknown',
    }))
  })
})
