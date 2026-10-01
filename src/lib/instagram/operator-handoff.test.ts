import { describe, expect, it, vi } from 'vitest'
import {
  claimInstagramHandoff,
  ignoreInstagramHandoff,
  releaseInstagramConversation,
  sendInstagramOperatorReply,
  takeOverInstagramConversation,
} from './operator-handoff'

function createRpcAdmin(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  return {
    rpc: vi.fn().mockImplementation(async () => responses.shift() ?? { data: null, error: null }),
  }
}

const tenantId = '10000000-0000-4000-8000-000000000001'
const conversationId = '20000000-0000-4000-8000-000000000001'
const actorUserId = '30000000-0000-4000-8000-000000000001'
const outboundMessageId = '40000000-0000-4000-8000-000000000001'

describe('Instagram operator handoff', () => {
  it('preserves the Supabase client receiver when invoking a dynamic RPC name', async () => {
    const receiver: { rpc?: ReturnType<typeof vi.fn> } = {}
    const rpc = vi.fn(function (this: unknown) {
      if (this !== receiver) throw new Error('rpc receiver was detached')
      return Promise.resolve({ data: 'claimed', error: null })
    })
    receiver.rpc = rpc

    await expect(claimInstagramHandoff(receiver as never, {
      tenantId,
      conversationId,
      actorUserId,
    })).resolves.toBe('claimed')
  })

  it('takes over an active conversation through a tenant-scoped RPC', async () => {
    const admin = createRpcAdmin([{ data: 'taken_over', error: null }])

    await expect(takeOverInstagramConversation(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
    })).resolves.toBe('taken_over')
    expect(admin.rpc).toHaveBeenCalledWith('take_over_instagram_conversation', {
      p_theatre_id: tenantId,
      p_conversation_id: conversationId,
      p_actor_user_id: actorUserId,
    })
  })

  it('returns a manually controlled conversation to TALIA through a tenant-scoped RPC', async () => {
    const admin = createRpcAdmin([{ data: 'released', error: null }])

    await expect(releaseInstagramConversation(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
    })).resolves.toBe('released')
    expect(admin.rpc).toHaveBeenCalledWith('release_instagram_conversation', {
      p_theatre_id: tenantId,
      p_conversation_id: conversationId,
      p_actor_user_id: actorUserId,
    })
  })

  it('claims an active handoff through a tenant-scoped RPC', async () => {
    const admin = createRpcAdmin([{ data: 'claimed', error: null }])

    await expect(claimInstagramHandoff(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
    })).resolves.toBe('claimed')
    expect(admin.rpc).toHaveBeenCalledWith('claim_instagram_handoff', {
      p_theatre_id: tenantId,
      p_conversation_id: conversationId,
      p_actor_user_id: actorUserId,
    })
  })

  it('retries an idempotent claim when the first result is transiently unavailable', async () => {
    const admin = createRpcAdmin([
      { data: 'unavailable', error: null },
      { data: 'claimed', error: null },
    ])

    await expect(claimInstagramHandoff(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
    })).resolves.toBe('claimed')
    expect(admin.rpc).toHaveBeenCalledTimes(2)
  })

  it('recovers an ambiguous claim error through the idempotent already-claimed result', async () => {
    const admin = createRpcAdmin([
      { data: null, error: { message: 'transient network failure' } },
      { data: 'already_claimed', error: null },
    ])

    await expect(claimInstagramHandoff(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
    })).resolves.toBe('already_claimed')
    expect(admin.rpc).toHaveBeenCalledTimes(2)
  })

  it('persists, starts and confirms a human-agent reply before recording usage', async () => {
    const admin = createRpcAdmin([
      {
        data: {
          state: 'prepared',
          outbound_message_id: outboundMessageId,
          instagram_user_id: 'ig-professional-account',
          recipient_igsid: 'igsid-visitor',
          body_text: 'Respuesta humana',
          use_human_agent_tag: true,
        },
        error: null,
      },
      { data: 'started', error: null },
      { data: true, error: null },
    ])
    const send = vi.fn().mockResolvedValue({ ok: true, providerMessageId: 'ig-message-outbound' })
    const recordUsage = vi.fn().mockResolvedValue({ ok: true })

    const result = await sendInstagramOperatorReply(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
      body: 'Respuesta humana',
      idempotencyKey: '50000000-0000-4000-8000-000000000001',
    }, {
      send,
      recordUsage: recordUsage as never,
      resolveAccessToken: async () => 'tenant-token',
    })

    expect(result).toEqual({ outcome: 'sent', outboundMessageId })
    expect(send).toHaveBeenCalledWith({
      instagramUserId: 'ig-professional-account',
      recipientInstagramScopedId: 'igsid-visitor',
      body: 'Respuesta humana',
      messagingType: 'human_agent',
    }, { accessToken: 'tenant-token' })
    expect(admin.rpc).toHaveBeenNthCalledWith(3, 'complete_instagram_operator_reply', expect.objectContaining({
      p_provider_message_id: 'ig-message-outbound',
    }))
    expect(recordUsage).toHaveBeenCalledWith(admin, expect.objectContaining({
      channel: 'instagram',
      idempotencyKey: `instagram:${outboundMessageId}:outbound`,
      metadata: expect.objectContaining({ origin: 'operator_handoff' }),
    }))
  })

  it('claims a free handoff and retries preparation when stale UI skipped the claim step', async () => {
    const admin = createRpcAdmin([
      { data: { state: 'not_assigned' }, error: null },
      { data: 'claimed', error: null },
      {
        data: {
          state: 'prepared',
          outbound_message_id: outboundMessageId,
          instagram_user_id: 'ig-professional-account',
          recipient_igsid: 'igsid-visitor',
          body_text: 'Respuesta humana',
          use_human_agent_tag: false,
        },
        error: null,
      },
      { data: 'started', error: null },
      { data: true, error: null },
    ])
    const send = vi.fn().mockResolvedValue({ ok: true, providerMessageId: 'ig-message-outbound' })

    await expect(sendInstagramOperatorReply(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
      body: 'Respuesta humana',
      idempotencyKey: '50000000-0000-4000-8000-000000000001',
    }, {
      send,
      recordUsage: vi.fn().mockResolvedValue({ ok: true }) as never,
      resolveAccessToken: async () => 'tenant-token',
    })).resolves.toEqual({ outcome: 'sent', outboundMessageId })

    expect(admin.rpc).toHaveBeenNthCalledWith(1, 'prepare_instagram_operator_reply', expect.any(Object))
    expect(admin.rpc).toHaveBeenNthCalledWith(2, 'claim_instagram_handoff', expect.any(Object))
    expect(admin.rpc).toHaveBeenNthCalledWith(3, 'prepare_instagram_operator_reply', expect.any(Object))
    expect(send).toHaveBeenCalledOnce()
  })

  it('does not send when another operator owns the handoff', async () => {
    const admin = createRpcAdmin([
      { data: { state: 'not_assigned' }, error: null },
      { data: 'already_assigned', error: null },
    ])
    const send = vi.fn()

    await expect(sendInstagramOperatorReply(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
      body: 'Respuesta humana',
      idempotencyKey: '50000000-0000-4000-8000-000000000001',
    }, { send })).resolves.toEqual({ outcome: 'not_assigned' })

    expect(send).not.toHaveBeenCalled()
  })

  it('uses the standard response window for a recent human reply', async () => {
    const admin = createRpcAdmin([
      {
        data: {
          state: 'prepared',
          outbound_message_id: outboundMessageId,
          instagram_user_id: 'ig-professional-account',
          recipient_igsid: 'igsid-visitor',
          body_text: 'Respuesta reciente',
          use_human_agent_tag: false,
        },
        error: null,
      },
      { data: 'started', error: null },
      { data: true, error: null },
    ])
    const send = vi.fn().mockResolvedValue({ ok: true, providerMessageId: 'ig-message-outbound' })

    await sendInstagramOperatorReply(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
      body: 'Respuesta reciente',
      idempotencyKey: '50000000-0000-4000-8000-000000000001',
    }, { send, recordUsage: vi.fn().mockResolvedValue({ ok: true }) as never, resolveAccessToken: async () => 'tenant-token' })

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ messagingType: 'response' }), {
      accessToken: 'tenant-token',
    })
  })

  it('fails closed without calling Meta when the seven-day human-agent window expired', async () => {
    const admin = createRpcAdmin([{ data: { state: 'human_agent_window_expired' }, error: null }])
    const send = vi.fn()

    const result = await sendInstagramOperatorReply(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
      body: 'Respuesta tardía',
      idempotencyKey: '50000000-0000-4000-8000-000000000001',
    }, { send })

    expect(result).toEqual({ outcome: 'human_agent_window_expired' })
    expect(send).not.toHaveBeenCalled()
  })

  it('persists an uncertain provider outcome and never retries automatically', async () => {
    const admin = createRpcAdmin([
      {
        data: {
          state: 'prepared',
          outbound_message_id: outboundMessageId,
          instagram_user_id: 'ig-professional-account',
          recipient_igsid: 'igsid-visitor',
          body_text: 'Respuesta humana',
          use_human_agent_tag: true,
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
      errorCode: 'meta_instagram_network_outcome_unknown',
    })

    const result = await sendInstagramOperatorReply(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
      body: 'Respuesta humana',
      idempotencyKey: '50000000-0000-4000-8000-000000000001',
    }, { send, resolveAccessToken: async () => 'tenant-token' })

    expect(result).toEqual({
      outcome: 'uncertain',
      outboundMessageId,
      errorCode: 'meta_instagram_network_outcome_unknown',
    })
    expect(send).toHaveBeenCalledOnce()
    expect(admin.rpc).toHaveBeenNthCalledWith(3, 'fail_instagram_operator_reply', expect.objectContaining({
      p_delivery_status: 'unknown',
    }))
  })

  it('ignores an active handoff through the audited resolution RPC', async () => {
    const admin = createRpcAdmin([{ data: 'ignored', error: null }])

    await expect(ignoreInstagramHandoff(admin as never, {
      tenantId,
      conversationId,
      actorUserId,
    })).resolves.toBe('ignored')
    expect(admin.rpc).toHaveBeenCalledWith('ignore_instagram_handoff', {
      p_theatre_id: tenantId,
      p_conversation_id: conversationId,
      p_actor_user_id: actorUserId,
    })
  })
})
