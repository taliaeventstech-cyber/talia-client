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
  it('coalesces a burst, discloses the AI, and sends one reply linked to the latest message', async () => {
    const admin = createAdmin()
    const requestAgent = vi.fn(async () => agentResponse())
    const sendText = vi.fn(async () => ({ ok: true as const, providerMessageId: 'wamid.outbound' }))

    const result = await processWhatsappInboundJobs(admin.client, {
      workerId: 'worker-1', requestAgent, sendText,
    })

    expect(result).toEqual({
      claimed: 1, responded: 1, handoffs: 0, retried: 0, deferred: 0, failed: 0,
    })
    expect(admin.calls.map(([name]) => name)).toEqual([
      'claim_whatsapp_inbound_jobs',
      'get_whatsapp_inbound_job_context',
      'prepare_whatsapp_conversation_turn',
      'start_whatsapp_conversation_turn_send',
      'complete_whatsapp_conversation_turn',
    ])
    expect(requestAgent).toHaveBeenCalledWith(expect.objectContaining({
      messageId: '60000000-0000-4000-8000-000000000003',
      message: 'Hola, ¿qué tal?\nMe gustaría saber si el teatro\nes accesible, gracias.',
    }))
    expect(sendText).toHaveBeenCalledWith({
      phoneNumberId: 'phone-1',
      recipientWaId: '34123456789',
      body: 'Hola, soy TALIA, el asistente virtual con IA de Sala Ejemplo.\n\nRespuesta segura',
      replyToProviderMessageId: 'wamid.inbound.3',
    })
    expect(admin.calls).toContainEqual([
      'prepare_whatsapp_conversation_turn',
      expect.objectContaining({
        p_agent_metadata: expect.objectContaining({
          ai_disclosure_included: true,
          ai_disclosure_version: 1,
          turn_message_count: 3,
        }),
      }),
    ])
    expect(inboundUsageKeys()).toEqual([
      'whatsapp:60000000-0000-4000-8000-000000000001:inbound',
      'whatsapp:60000000-0000-4000-8000-000000000002:inbound',
      'whatsapp:60000000-0000-4000-8000-000000000003:inbound',
    ])
    expect(recordMeasuredAiUsage).toHaveBeenCalledOnce()
  })

  it('does not repeat the AI disclosure after it has been confirmed for the conversation', async () => {
    const admin = createAdmin({ aiDisclosureRequired: false })
    const sendText = vi.fn(async () => ({ ok: true as const, providerMessageId: 'wamid.outbound' }))

    await processWhatsappInboundJobs(admin.client, {
      workerId: 'worker-1', requestAgent: async () => agentResponse(), sendText,
    })

    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ body: 'Respuesta segura' }))
    expect(admin.calls).toContainEqual([
      'prepare_whatsapp_conversation_turn',
      expect.objectContaining({
        p_agent_metadata: expect.not.objectContaining({ ai_disclosure_included: true }),
      }),
    ])
  })

  it('localizes the disclosure to the agent response language', async () => {
    const admin = createAdmin()
    const sendText = vi.fn(async () => ({ ok: true as const, providerMessageId: 'wamid.outbound' }))

    await processWhatsappInboundJobs(admin.client, {
      workerId: 'worker-1', requestAgent: async () => agentResponse('ca'), sendText,
    })

    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
      body: "Hola, soc TALIA, l'assistent virtual amb IA de Sala Ejemplo.\n\nRespuesta segura",
    }))
  })

  it('defers a generated reply when a newer inbound message makes the turn stale', async () => {
    const admin = createAdmin({ prepareState: 'stale' })
    const sendText = vi.fn()

    const result = await processWhatsappInboundJobs(admin.client, {
      workerId: 'worker-1', requestAgent: async () => agentResponse(), sendText,
    })

    expect(result).toEqual({
      claimed: 1, responded: 0, handoffs: 0, retried: 0, deferred: 1, failed: 0,
    })
    expect(sendText).not.toHaveBeenCalled()
    expect(admin.calls.some(([name]) => name === 'start_whatsapp_conversation_turn_send')).toBe(false)
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

    expect(result).toEqual({
      claimed: 1, responded: 0, handoffs: 0, retried: 0, deferred: 0, failed: 1,
    })
    expect(admin.calls).toContainEqual([
      'complete_whatsapp_conversation_turn_handoff',
      expect.objectContaining({
        p_reason: 'provider_send_outcome_unknown',
        p_failed: true,
        p_outbound_delivery_status: 'unknown',
      }),
    ])
    expect(admin.calls.some(([name]) => name === 'retry_whatsapp_conversation_turn')).toBe(false)
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

    expect(result).toEqual({
      claimed: 1, responded: 0, handoffs: 0, retried: 1, deferred: 0, failed: 0,
    })
    expect(requestAgent).not.toHaveBeenCalled()
    expect(admin.calls).toContainEqual([
      'retry_whatsapp_conversation_turn',
      expect.objectContaining({ p_error_code: 'meta_http_503' }),
    ])
  })
})

function createAdmin(overrides: {
  outbound?: ReturnType<typeof preparedOutbound> | null
  aiDisclosureRequired?: boolean
  prepareState?: 'prepared' | 'stale'
} = {}) {
  const calls: Array<[string, Record<string, unknown>]> = []
  const context = jobContext(
    overrides.outbound ?? null,
    overrides.aiDisclosureRequired ?? true,
  )
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push([name, args])
    if (name === 'claim_whatsapp_inbound_jobs') {
      return {
        data: [{
          job_id: context.job.id,
          message_id: context.message.id,
          theatre_id: context.tenant.id,
          connection_id: context.connection.id,
          attempt_count: 1,
        }],
        error: null,
      }
    }
    if (name === 'get_whatsapp_inbound_job_context') return { data: context, error: null }
    if (name === 'prepare_whatsapp_conversation_turn') {
      if (overrides.prepareState === 'stale') return { data: { state: 'stale' }, error: null }
      return {
        data: {
          state: 'prepared',
          outbound: preparedOutbound(String(args.p_reply), args.p_agent_metadata as Record<string, unknown>),
        },
        error: null,
      }
    }
    if (name === 'start_whatsapp_conversation_turn_send') return { data: 'started', error: null }
    if (name === 'retry_whatsapp_conversation_turn') return { data: 'retry', error: null }
    if (name === 'complete_whatsapp_conversation_turn_handoff') return { data: 'handoff', error: null }
    return { data: true, error: null }
  })
  return { client: { rpc } as never, calls }
}

function jobContext(
  outbound: ReturnType<typeof preparedOutbound> | null,
  aiDisclosureRequired: boolean,
) {
  const messageIds = [
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000003',
  ]
  return {
    job: { id: '10000000-0000-4000-8000-000000000001', attempt_count: 1 },
    turn: {
      job_ids: [
        '11000000-0000-4000-8000-000000000001',
        '11000000-0000-4000-8000-000000000002',
        '11000000-0000-4000-8000-000000000003',
      ],
      message_ids: messageIds,
      message_count: 3,
      ai_disclosure_required: aiDisclosureRequired,
    },
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
      id: messageIds[2],
      provider_message_id: 'wamid.inbound.3',
      body_text: 'Hola, ¿qué tal?\nMe gustaría saber si el teatro\nes accesible, gracias.',
      created_at: '2026-08-16T10:00:02Z',
    },
    conversation_context: [],
    outbound,
  }
}

function preparedOutbound(
  bodyText = 'Respuesta segura',
  metadata: Record<string, unknown> = { agent: 'whatsapp_agent' },
) {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    body_text: bodyText,
    provider_message_id: 'agent-pending:60000000-0000-4000-8000-000000000003',
    delivery_status: 'queued' as const,
    metadata,
  }
}

function agentResponse(responseLanguage = 'es') {
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
        response_language: responseLanguage,
        resolution: { version: 1, state: 'answered_with_evidence', clarification_attempts: 0 },
      },
    },
  }
}

function inboundUsageKeys() {
  return recordUsageEvent.mock.calls
    .map(([, input]) => input as { idempotencyKey: string; metadata?: { direction?: string } })
    .filter((input) => input.metadata?.direction === 'inbound')
    .map((input) => input.idempotencyKey)
}
