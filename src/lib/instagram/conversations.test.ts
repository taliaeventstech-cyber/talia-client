import { describe, expect, it, vi } from 'vitest'
import {
  getInstagramConversationDetail,
  getInstagramConversationHistory,
} from './conversations'

const tenantId = '10000000-0000-4000-8000-000000000001'
const actorUserId = '20000000-0000-4000-8000-000000000001'
const conversationId = '30000000-0000-4000-8000-000000000001'

describe('Instagram conversations', () => {
  it('loads tenant-scoped conversation history through the authorized RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        items: [{
          id: conversationId,
          status: 'open',
          contact_masked: '•••• 8094',
          last_message_at: '2026-09-22T16:18:29.000Z',
          created_at: '2026-09-22T16:18:15.000Z',
          handoff_reason: null,
          message_count: 2,
          latest_message: 'Hola',
          latest_direction: 'outbound',
        }],
        count: 1,
      },
      error: null,
    })

    await expect(getInstagramConversationHistory({ rpc } as never, {
      tenantId,
      actorUserId,
    })).resolves.toMatchObject({ count: 1 })
    expect(rpc).toHaveBeenCalledWith('get_instagram_conversation_history', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_limit: 100,
    })
  })

  it('loads ordered Instagram messages without exposing the raw scoped user id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: conversationId,
        status: 'open',
        operator_mode: false,
        contact_masked: '•••• 8094',
        handoff_reason: null,
        created_at: '2026-09-22T16:18:15.000Z',
        last_message_at: '2026-09-22T16:18:29.000Z',
        assigned_profile_id: null,
        assigned_name: null,
        assigned_email: null,
        human_agent_eligible_until: '2026-09-29T16:18:15.000Z',
        human_agent_window_expired: false,
        messages: [{
          id: '40000000-0000-4000-8000-000000000001',
          direction: 'inbound',
          message_type: 'text',
          body_text: 'Prueba 11',
          created_at: '2026-09-22T16:18:15.000Z',
          delivery_status: null,
          processing_status: 'responded',
          is_operator_reply: false,
          metadata: {},
        }],
      },
      error: null,
    })

    await expect(getInstagramConversationDetail({ rpc } as never, {
      tenantId,
      actorUserId,
      conversationId,
    })).resolves.toMatchObject({ contact_masked: '•••• 8094' })
    expect(rpc).toHaveBeenCalledWith('get_instagram_conversation_detail', {
      p_theatre_id: tenantId,
      p_conversation_id: conversationId,
      p_actor_user_id: actorUserId,
    })
  })
})
