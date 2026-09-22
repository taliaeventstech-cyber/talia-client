import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeChannelAgentPolicy } from '@/lib/attention/channel-agent'
import { requestInstagramAgent } from './talia-ai'

afterEach(() => vi.unstubAllEnvs())

describe('requestInstagramAgent', () => {
  it('calls only the dedicated Instagram runtime with channel-local history', async () => {
    vi.stubEnv('TALIA_AI_BASE_URL', 'https://talia-ai.example.test/')
    vi.stubEnv('TALIA_AI_INTERNAL_API_KEY', 'internal-secret')
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      ok: true,
      action: 'respond',
      reply: 'Abrimos a las 18:00.',
      provider: 'talia-ai',
      model: 'gpt-test',
      usage_components: [],
      usage_summary: { request_count: 1, input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
      sources: [],
      metadata: { response_language: 'es', response_kind: 'answer' },
    }))

    const result = await requestInstagramAgent({
      tenantId: '00000000-0000-4000-8000-000000000001',
      connectionId: 'instagram-connection-1',
      conversationId: 'instagram-conversation-1',
      messageId: 'instagram-message-1',
      message: '¿A qué hora abrís?',
      fallbackLanguage: 'es',
      conversationContext: [{ role: 'user', content: 'Hola' }],
      tenant: { name: 'Sala', fallbackEmail: null, fallbackPhone: null },
      policy: normalizeChannelAgentPolicy('instagram', { enabled: true, tone: 'brief' }),
    }, { fetcher })

    expect(result).toMatchObject({ ok: true, result: { action: 'respond' } })
    expect(fetcher).toHaveBeenCalledWith('https://talia-ai.example.test/v1/instagram/respond', expect.any(Object))
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    expect(body).toMatchObject({
      connection_id: 'instagram-connection-1',
      conversation_id: 'instagram-conversation-1',
      tenant: { agent_settings: { tone: 'brief', fallback_mode: 'human_handoff' } },
    })
  })

  it('fails closed when a handoff contains sendable text', async () => {
    vi.stubEnv('TALIA_AI_BASE_URL', 'https://talia-ai.example.test')
    vi.stubEnv('TALIA_AI_INTERNAL_API_KEY', 'internal-secret')
    const result = await requestInstagramAgent({
      tenantId: '00000000-0000-4000-8000-000000000001',
      connectionId: 'connection-1', conversationId: 'conversation-1', messageId: 'message-1',
      message: 'Pregunta', fallbackLanguage: 'es', conversationContext: [],
      tenant: { name: 'Sala', fallbackEmail: null, fallbackPhone: null },
      policy: normalizeChannelAgentPolicy('instagram', { enabled: true }),
    }, {
      fetcher: async () => Response.json({
        ok: true, action: 'handoff', reply: 'No debe enviarse', provider: 'talia-ai', model: 'test',
        usage_components: [],
        usage_summary: { request_count: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
        sources: [], metadata: {},
      }),
    })

    expect(result).toMatchObject({ ok: false, retryable: true, errorCode: 'talia_ai_invalid_response' })
  })
})
