import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeChannelAgentPolicy } from '@/lib/attention/channel-agent'
import { requestWhatsappAgent } from './talia-ai'

afterEach(() => vi.unstubAllEnvs())

describe('requestWhatsappAgent', () => {
  it('calls the dedicated endpoint with channel-local policy and history', async () => {
    vi.stubEnv('TALIA_AI_BASE_URL', 'https://talia-ai.example.test/')
    vi.stubEnv('TALIA_AI_INTERNAL_API_KEY', 'internal-secret')
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      ok: true,
      action: 'respond',
      reply: 'Obrimos às 18h.',
      provider: 'talia-ai',
      model: 'gpt-test',
      usage_components: [],
      usage_summary: { request_count: 1, input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
      sources: [],
      metadata: { response_language: 'pt', response_kind: 'answer' },
    }))

    const result = await requestWhatsappAgent({
      tenantId: '00000000-0000-4000-8000-000000000001',
      connectionId: 'connection-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      message: 'A que horas abrem?',
      fallbackLanguage: 'es',
      conversationContext: [{ role: 'user', content: 'Olá' }],
      tenant: { name: 'Sala', fallbackEmail: null, fallbackPhone: null },
      policy: normalizeChannelAgentPolicy('whatsapp', { enabled: true, tone: 'brief' }),
    }, { fetcher })

    expect(result).toMatchObject({ ok: true, result: { action: 'respond', reply: 'Obrimos às 18h.' } })
    expect(fetcher).toHaveBeenCalledWith('https://talia-ai.example.test/v1/whatsapp/respond', expect.any(Object))
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    expect(body).toMatchObject({
      conversation_id: 'conversation-1',
      message_id: 'message-1',
      fallback_language: 'es',
      conversation_context: [{ role: 'user', content: 'Olá' }],
      tenant: { agent_settings: { tone: 'brief', fallback_mode: 'human_handoff' } },
    })
  })

  it('rejects a handoff that includes sendable text', async () => {
    vi.stubEnv('TALIA_AI_BASE_URL', 'https://talia-ai.example.test')
    vi.stubEnv('TALIA_AI_INTERNAL_API_KEY', 'internal-secret')
    const result = await requestWhatsappAgent({
      tenantId: '00000000-0000-4000-8000-000000000001',
      connectionId: 'connection-1', conversationId: 'conversation-1', messageId: 'message-1',
      message: 'Pregunta', fallbackLanguage: 'es', conversationContext: [],
      tenant: { name: 'Sala', fallbackEmail: null, fallbackPhone: null },
      policy: normalizeChannelAgentPolicy('whatsapp', { enabled: true }),
    }, {
      fetcher: async () => Response.json({
        ok: true, action: 'handoff', reply: 'Este texto no debe enviarse', provider: 'talia-ai', model: 'test',
        usage_components: [],
        usage_summary: { request_count: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
        sources: [], metadata: {},
      }),
    })

    expect(result).toMatchObject({ ok: false, retryable: true, errorCode: 'talia_ai_invalid_response' })
  })
})
