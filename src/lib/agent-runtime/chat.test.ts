// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChatAgentProvider, N8nChatAgentProvider, type ChatAgentRuntimeInput } from './chat'
import { TaliaAiChatAgentProvider } from './talia-ai'

const runtimeInput: ChatAgentRuntimeInput = {
  tenantId: 'tenant-1',
  sessionId: 'session-1',
  message: 'Hola',
  n8nWebhookUrl: 'https://n8n.example.test/webhook/chat',
  tenant: {
    name: 'Sala Test',
    language: 'es',
    responseTone: 'close',
    systemPrompt: 'Responde como TALIA.',
    fallbackEmail: 'info@example.test',
    fallbackPhone: '+34000000000',
  },
}

describe('N8nChatAgentProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns a configuration error when the webhook is missing', async () => {
    const provider = new N8nChatAgentProvider()

    const result = await provider.respond({
      ...runtimeInput,
      n8nWebhookUrl: null,
    })

    expect(result).toEqual({
      ok: false,
      provider: 'n8n',
      status: 503,
      error: 'Chat is not configured for this tenant',
    })
  })

  it('normalizes successful n8n responses into the chat runtime contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ reply: 'Respuesta de TALIA' }),
    }))

    const provider = new N8nChatAgentProvider()
    const result = await provider.respond({
      ...runtimeInput,
      relevantKnowledge: [{
        id: 'chunk-1',
        sourceId: 'source-1',
        sourceType: 'pdf',
        question: 'Documento',
        answer: 'Contenido relevante',
        category: 'documento',
        priority: 45,
        score: 10,
      }],
    })

    expect(result).toMatchObject({
      ok: true,
      provider: 'n8n',
      reply: 'Respuesta de TALIA',
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://n8n.example.test/webhook/chat',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })
})

describe('TaliaAiChatAgentProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete process.env.TALIA_AI_BASE_URL
    delete process.env.TALIA_AI_INTERNAL_API_KEY
    delete process.env.CHAT_AGENT_PROVIDER
  })

  it('returns a configuration error when talia-ai env vars are missing', async () => {
    const provider = new TaliaAiChatAgentProvider()

    const result = await provider.respond(runtimeInput)

    expect(result).toEqual({
      ok: false,
      provider: 'talia-ai',
      status: 503,
      error: 'TALIA AI service is not configured',
    })
  })

  it('sends tenant context and relevant knowledge to talia-ai', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        reply: 'Respuesta desde talia-ai',
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: { input_tokens: 10, output_tokens: 4 },
      }),
    }))

    const provider = new TaliaAiChatAgentProvider()
    const result = await provider.respond({
      ...runtimeInput,
      pageUrl: 'https://talia.events/pricing',
      pendingClarification: {
        intent: 'pricing',
        reason: 'ambiguous_price_intent',
        optionKeys: ['tickets', 'plans'],
        options: ['entradas', 'planes'],
      },
      relevantKnowledge: [{
        id: 'chunk-1',
        sourceId: 'source-1',
        sourceType: 'pdf',
        question: 'Documento',
        answer: 'Contenido relevante',
        category: 'documento',
        priority: 45,
        score: 10,
      }],
    })

    expect(result).toMatchObject({
      ok: true,
      provider: 'talia-ai',
      reply: 'Respuesta desde talia-ai',
      model: 'gpt-4o-mini',
    })

    const [, requestInit] = vi.mocked(fetch).mock.calls[0]
    expect(fetch).toHaveBeenCalledWith(
      'https://talia-ai.example.test/v1/chat/respond',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
        }),
      }),
    )
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      tenant_id: 'tenant-1',
      session_id: 'session-1',
      page_url: 'https://talia.events/pricing',
      pending_clarification: {
        intent: 'pricing',
        reason: 'ambiguous_price_intent',
        option_keys: ['tickets', 'plans'],
        options: ['entradas', 'planes'],
      },
      language: 'es',
      tenant: {
        name: 'Sala Test',
        response_tone: 'close',
        system_prompt: 'Responde como TALIA.',
      },
      relevant_knowledge: [{
        id: 'chunk-1',
        source_id: 'source-1',
        source_type: 'pdf',
        score: 0.5,
      }],
    })
    expect(JSON.parse(String(requestInit?.body)).tenant).not.toHaveProperty('fallback_email')
    expect(JSON.parse(String(requestInit?.body)).tenant).not.toHaveProperty('fallback_phone')
  })

  it('sends fallback contacts to talia-ai only when useful knowledge is missing', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        reply: 'Respuesta desde talia-ai',
        provider: 'openai',
      }),
    }))

    const provider = new TaliaAiChatAgentProvider()
    await provider.respond({
      ...runtimeInput,
      tenant: {
        ...runtimeInput.tenant,
        aiSettings: {
          temperature: 0.2,
          groundingMode: 'strict',
          minContextScore: 0.3,
          maxContextItems: 5,
          fallbackContacts: true,
          fallbackMessage: 'No podemos confirmar esa información.',
          fallbackWhatsApp: true,
        },
      },
      relevantKnowledge: [],
    })

    const [, requestInit] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(requestInit?.body)).tenant).toMatchObject({
      fallback_email: 'info@example.test',
      fallback_phone: '+34000000000',
      fallback: {
        custom_message: 'No podemos confirmar esa información.',
        whatsapp_enabled: true,
      },
    })
  })

  it('selects talia-ai and falls back to n8n on transient provider errors', async () => {
    process.env.CHAT_AGENT_PROVIDER = 'talia-ai'
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ ok: false, error: 'temporarily_unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ reply: 'Respuesta fallback n8n' }),
      }))

    const provider = createChatAgentProvider()
    const result = await provider.respond(runtimeInput)

    expect(result).toMatchObject({
      ok: true,
      provider: 'n8n',
      reply: 'Respuesta fallback n8n',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
