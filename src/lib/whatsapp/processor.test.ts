import { beforeEach, describe, expect, it, vi } from 'vitest'

const { recordUsageEvent, recordMeasuredAiUsage } = vi.hoisted(() => ({
  recordUsageEvent: vi.fn(),
  recordMeasuredAiUsage: vi.fn(),
}))

vi.mock('@/lib/usage/service', () => ({ recordUsageEvent }))
vi.mock('@/lib/usage/ai-cost', () => ({ recordMeasuredAiUsage }))

import { processWhatsappInboundJobs } from './processor'

beforeEach(() => {
  recordUsageEvent.mockReset()
  recordMeasuredAiUsage.mockReset()
  recordUsageEvent.mockResolvedValue({ ok: true, duplicate: false, eventId: 'usage-1' })
  recordMeasuredAiUsage.mockResolvedValue({ ok: true, inserted: 0 })
})

describe('processWhatsappInboundJobs', () => {
  it('persists a reply before sending it and completes only after Meta confirms it', async () => {
    const admin = createAdmin()
    const requestAgent = vi.fn(async () => agentResponse())
    const sendText = vi.fn(async () => ({ ok: true as const, providerMessageId: 'wamid.outbound' }))

    const result = await processWhatsappInboundJobs(admin.client, {
      workerId: 'worker-1', requestAgent, sendText,
    })

    expect(result).toEqual({ claimed: 1, responded: 1, handoffs: 0, retried: 0, failed: 0 })
    expect(admin.calls.map(([name]) => name)).toEqual([
      'claim_whatsapp_inbound_jobs',
      'get_whatsapp_inbound_job_context',
      'prepare_whatsapp_agent_reply',
      'mark_whatsapp_agent_send_started',
      'complete_whatsapp_agent_reply',
    ])
    expect(sendText).toHaveBeenCalledWith({
      phoneNumberId: 'phone-1',
      recipientWaId: '34123456789',
      body: 'Respuesta segura',
      replyToProviderMessageId: 'wamid.inbound',
    })
    expect(recordMeasuredAiUsage).toHaveBeenCalledOnce()
  })

  it('does not retry an uncertain provider outcome', async () => {
    const admin = createAdmin()
    const result = await processWhatsappInboundJobs(admin.client, {
      workerId: 'worker-1',
      requestAgent: async () => agentResponse(),
      sendText: async () => ({
        ok: false as const,
        outcome: 'uncertain' as const,
        status: null,
        errorCode: 'meta_network_outcome_unknown',
      }),
    })

    expect(result).toEqual({ claimed: 1, responded: 0, handoffs: 0, retried: 0, failed: 1 })
    expect(admin.calls).toContainEqual([
      'complete_whatsapp_agent_handoff',
      expect.objectContaining({
        p_reason: 'provider_send_outcome_unknown',
        p_failed: true,
        p_outbound_delivery_status: 'unknown',
      }),
    ])
    expect(admin.calls.some(([name]) => name === 'retry_whatsapp_agent_reply')).toBe(false)
  })

  it('retries a confirmed transient rejection without running the agent twice', async () => {
    const admin = createAdmin({ outbound: preparedOutbound() })
    const requestAgent = vi.fn()
    const result = await processWhatsappInboundJobs(admin.client, {
      workerId: 'worker-1',
      requestAgent,
      sendText: async () => ({
        ok: false as const,
        outcome: 'transient_rejection' as const,
        status: 503,
        errorCode: 'meta_http_503',
      }),
    })

    expect(result).toEqual({ claimed: 1, responded: 0, handoffs: 0, retried: 1, failed: 0 })
    expect(requestAgent).not.toHaveBeenCalled()
    expect(admin.calls).toContainEqual([
      'retry_whatsapp_agent_reply',
      expect.objectContaining({ p_error_code: 'meta_http_503' }),
    ])
  })
})

function createAdmin(overrides: { outbound?: ReturnType<typeof preparedOutbound> | null } = {}) {
  const calls: Array<[string, Record<string, unknown>]> = []
  const context = jobContext(overrides.outbound ?? null)
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push([name, args])
    if (name === 'claim_whatsapp_inbound_jobs') {
      return { data: [{ job_id: context.job.id, message_id: context.message.id, theatre_id: context.tenant.id, connection_id: context.connection.id, attempt_count: 1 }], error: null }
    }
    if (name === 'get_whatsapp_inbound_job_context') return { data: context, error: null }
    if (name === 'prepare_whatsapp_agent_reply') return { data: preparedOutbound(), error: null }
    return { data: true, error: null }
  })
  return { client: { rpc } as never, calls }
}

function jobContext(outbound: ReturnType<typeof preparedOutbound> | null) {
  return {
    job: { id: '10000000-0000-4000-8000-000000000001', attempt_count: 1 },
    connection: {
      id: '20000000-0000-4000-8000-000000000001',
      phone_number_id: 'phone-1',
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
    contact: { id: '40000000-0000-4000-8000-000000000001', wa_id: '34123456789' },
    conversation: { id: '50000000-0000-4000-8000-000000000001', status: 'pending', metadata: {} },
    message: {
      id: '60000000-0000-4000-8000-000000000001',
      provider_message_id: 'wamid.inbound',
      body_text: '¿A qué hora abrís?',
      created_at: '2026-08-16T10:00:00Z',
    },
    conversation_context: [],
    outbound,
  }
}

function preparedOutbound() {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    body_text: 'Respuesta segura',
    provider_message_id: 'agent-pending:60000000-0000-4000-8000-000000000001',
    delivery_status: 'queued' as const,
    metadata: { agent: 'whatsapp_agent' },
  }
}

function agentResponse() {
  return {
    ok: true as const,
    result: {
      ok: true as const,
      action: 'respond' as const,
      reply: 'Respuesta segura',
      provider: 'talia-ai',
      model: 'gpt-test',
      usage_components: [],
      usage_summary: { request_count: 1, input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
      sources: [],
      metadata: {
        response_kind: 'answer',
        response_language: 'es',
        resolution: { version: 1, state: 'answered_with_evidence', clarification_attempts: 0 },
      },
    },
  }
}
