import { beforeEach, describe, expect, it, vi } from 'vitest'

const { recordUsageEvent, recordMeasuredAiUsage } = vi.hoisted(() => ({
  recordUsageEvent: vi.fn(),
  recordMeasuredAiUsage: vi.fn(),
}))

vi.mock('@/lib/usage/service', () => ({ recordUsageEvent }))
vi.mock('@/lib/usage/ai-cost', () => ({ recordMeasuredAiUsage }))

import { processInstagramInboundJobs } from './processor'

beforeEach(() => {
  recordUsageEvent.mockReset()
  recordMeasuredAiUsage.mockReset()
  recordUsageEvent.mockResolvedValue({ ok: true, duplicate: false, eventId: 'usage-1' })
  recordMeasuredAiUsage.mockResolvedValue({ ok: true, inserted: 0 })
})

describe('processInstagramInboundJobs', () => {
  it('uses the independent agent, discloses AI and sends one durable reply', async () => {
    const admin = createAdmin()
    const requestAgent = vi.fn(async () => agentResponse())
    const sendText = vi.fn(async () => ({ ok: true as const, providerMessageId: 'ig-outbound-1' }))

    const result = await processInstagramInboundJobs(admin.client, {
      workerId: 'instagram-worker-1',
      requestAgent,
      sendText,
      resolveAccessToken: async () => 'instagram-token',
    })

    expect(result).toEqual({
      claimed: 1, responded: 1, handoffs: 0, retried: 0, deferred: 0, failed: 0,
    })
    expect(admin.calls.map(([name]) => name)).toEqual([
      'claim_instagram_inbound_jobs',
      'get_instagram_inbound_job_context',
      'prepare_instagram_agent_reply',
      'start_instagram_agent_send',
      'complete_instagram_agent_reply',
    ])
    expect(requestAgent).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: '20000000-0000-4000-8000-000000000001',
      conversationId: '50000000-0000-4000-8000-000000000001',
      message: '¿A qué hora abrís?',
      policy: expect.objectContaining({ channel: 'instagram' }),
    }))
    expect(sendText).toHaveBeenCalledWith({
      instagramUserId: 'ig-professional-account',
      recipientInstagramScopedId: 'igsid-visitor',
      body: '¡Hola! Soy Talía, un agente de IA para Sala Ejemplo.\n\nAbrimos a las 18:00.',
    }, { accessToken: 'instagram-token' })
    expect(admin.calls).toContainEqual([
      'prepare_instagram_agent_reply',
      expect.objectContaining({
        p_agent_metadata: expect.objectContaining({
          agent: 'instagram_agent',
          ai_disclosure_included: true,
        }),
      }),
    ])
  })

  it('never retries after the provider-send boundary has been crossed', async () => {
    const admin = createAdmin()

    const result = await processInstagramInboundJobs(admin.client, {
      workerId: 'instagram-worker-1',
      requestAgent: async () => agentResponse(),
      sendText: async () => ({
        ok: false as const,
        outcome: 'transient_rejection' as const,
        status: 503,
        errorCode: 'meta_instagram_http_503',
      }),
      resolveAccessToken: async () => 'instagram-token',
    })

    expect(result).toEqual({
      claimed: 1, responded: 0, handoffs: 0, retried: 0, deferred: 0, failed: 1,
    })
    expect(admin.calls).toContainEqual([
      'complete_instagram_agent_handoff',
      expect.objectContaining({
        p_reason: 'provider_send_outcome_unknown',
        p_outbound_delivery_status: 'unknown',
      }),
    ])
    expect(admin.calls.some(([name]) => name === 'retry_instagram_agent_reply')).toBe(false)
  })

  it('hands off an unexpected transport exception after send start without retrying', async () => {
    const admin = createAdmin()

    const result = await processInstagramInboundJobs(admin.client, {
      workerId: 'instagram-worker-1',
      requestAgent: async () => agentResponse(),
      sendText: async () => { throw new Error('socket closed') },
      resolveAccessToken: async () => 'instagram-token',
    })

    expect(result.failed).toBe(1)
    expect(admin.calls).toContainEqual([
      'complete_instagram_agent_handoff',
      expect.objectContaining({
        p_reason: 'provider_send_outcome_unknown',
        p_outbound_delivery_status: 'unknown',
      }),
    ])
    expect(admin.calls.some(([name]) => name === 'retry_instagram_agent_reply')).toBe(false)
  })

  it('retries a transient agent failure before preparing or sending a reply', async () => {
    const admin = createAdmin()

    const result = await processInstagramInboundJobs(admin.client, {
      workerId: 'instagram-worker-1',
      requestAgent: async () => ({
        ok: false as const,
        retryable: true,
        status: 503,
        errorCode: 'talia_ai_http_503',
      }),
      sendText: vi.fn(),
      resolveAccessToken: async () => 'instagram-token',
    })

    expect(result).toEqual({
      claimed: 1, responded: 0, handoffs: 0, retried: 1, deferred: 0, failed: 0,
    })
    expect(admin.calls).toContainEqual([
      'retry_instagram_agent_reply',
      expect.objectContaining({ p_error_code: 'talia_ai_http_503' }),
    ])
    expect(admin.calls.some(([name]) => name === 'prepare_instagram_agent_reply')).toBe(false)
  })
})

function createAdmin() {
  const calls: Array<[string, Record<string, unknown>]> = []
  const context = jobContext()
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push([name, args])
    if (name === 'claim_instagram_inbound_jobs') {
      return { data: [{ job_id: context.job.id, attempt_count: 1 }], error: null }
    }
    if (name === 'get_instagram_inbound_job_context') return { data: context, error: null }
    if (name === 'prepare_instagram_agent_reply') {
      return {
        data: {
          state: 'prepared',
          outbound: preparedOutbound(String(args.p_reply), args.p_agent_metadata as Record<string, unknown>),
        },
        error: null,
      }
    }
    if (name === 'start_instagram_agent_send') return { data: 'started', error: null }
    if (name === 'retry_instagram_agent_reply') return { data: 'retry', error: null }
    if (name === 'complete_instagram_agent_handoff') return { data: 'handoff', error: null }
    return { data: true, error: null }
  })
  return { client: { rpc } as never, calls }
}

function jobContext() {
  return {
    job: { id: '10000000-0000-4000-8000-000000000001', attempt_count: 1 },
    connection: {
      id: '20000000-0000-4000-8000-000000000001',
      instagram_user_id: 'ig-professional-account',
      status: 'connected',
      rollout_enabled: true,
      metadata: { agent_settings: { enabled: true } },
    },
    tenant: {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'Sala Ejemplo',
      fallback_language: 'es',
      fallback_email: null,
      fallback_phone: null,
    },
    contact: {
      id: '40000000-0000-4000-8000-000000000001',
      instagram_scoped_user_id: 'igsid-visitor',
    },
    conversation: {
      id: '50000000-0000-4000-8000-000000000001',
      status: 'pending',
      metadata: {},
    },
    message: {
      id: '60000000-0000-4000-8000-000000000001',
      provider_message_id: 'ig-inbound-1',
      body_text: '¿A qué hora abrís?',
      created_at: '2026-09-22T10:00:00.000Z',
    },
    conversation_context: [],
    ai_disclosure_required: true,
    outbound: null,
  }
}

function preparedOutbound(body = 'Respuesta segura', metadata: Record<string, unknown> = {}) {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    body_text: body,
    provider_message_id: 'agent-pending:60000000-0000-4000-8000-000000000001',
    delivery_status: 'queued' as const,
    metadata,
  }
}

function agentResponse() {
  return {
    ok: true as const,
    result: {
      ok: true as const,
      action: 'respond' as const,
      reply: 'Abrimos a las 18:00.',
      provider: 'talia-ai',
      model: 'test-model',
      usage_components: [],
      usage_summary: { request_count: 1, input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
      sources: [],
      metadata: {
        response_language: 'es',
        response_kind: 'answer',
        resolution: { version: 1, state: 'answered_with_evidence' },
      },
    },
  }
}
