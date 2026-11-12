// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChatAgentProvider, type ChatAgentRuntimeInput } from './chat'
import { TaliaAiChatAgentProvider } from './talia-ai'

const runtimeInput: ChatAgentRuntimeInput = {
  tenantId: 'tenant-1',
  sessionId: 'session-1',
  message: 'Hola',
  timeZone: 'Europe/Madrid',
  tenant: {
    name: 'Sala Test',
    fallbackLanguage: 'es',
    responseTone: 'close',
    systemPrompt: 'Responde como TALIA.',
    fallbackEmail: 'info@example.test',
    fallbackPhone: '+34000000000',
    websiteUrl: 'https://example.test',
  },
}

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

  it('sends tenant and conversation context to talia-ai', async () => {
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
        usage_components: [
          {
            component: 'answer_agent',
            provider: 'openai',
            model: 'gpt-4o-mini',
            request_count: 1,
            input_tokens: 10,
            cached_input_tokens: 3,
            output_tokens: 4,
          },
          {
            component: 'official_web_search',
            provider: 'openai',
            model: 'gpt-5.5',
            request_count: 1,
            input_tokens: 20,
            cached_input_tokens: 0,
            output_tokens: 6,
            tool_calls: 2,
          },
        ],
        usage_summary: { request_count: 1, input_tokens: 10, cached_input_tokens: 3, output_tokens: 4 },
        metadata: { response_language: 'es' },
        actions: [{
          type: 'whatsapp',
          label: '+34 000 000 000',
          href: 'https://wa.me/34000000000',
        }],
      }),
    }))

    const provider = new TaliaAiChatAgentProvider()
    const result = await provider.respond({
      ...runtimeInput,
      pageUrl: 'https://talia.events/pricing',
      conversationContext: [
        { role: 'user', content: '¿Tenéis descuentos?' },
        { role: 'assistant', content: 'Sí. Las personas jubiladas tienen una tarifa de 15 €.' },
      ],
      pendingClarification: {
        intent: 'pricing',
        reason: 'ambiguous_price_intent',
        optionKeys: ['tickets', 'plans'],
        options: ['entradas', 'planes'],
      },
      previousResolution: {
        version: 1,
        state: 'needs_clarification',
        clarificationAttempts: 1,
        topic: 'precios',
        intent: 'information',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      provider: 'talia-ai',
      reply: 'Respuesta desde talia-ai',
      model: 'gpt-4o-mini',
      usageComponents: [
        {
          component: 'answer_agent',
          provider: 'openai',
          model: 'gpt-4o-mini',
          request_count: 1,
          input_tokens: 10,
          cached_input_tokens: 3,
          output_tokens: 4,
        },
        {
          component: 'official_web_search',
          provider: 'openai',
          model: 'gpt-5.5',
          request_count: 1,
          input_tokens: 20,
          cached_input_tokens: 0,
          output_tokens: 6,
          tool_calls: 2,
        },
      ],
      usageSummary: { request_count: 1, input_tokens: 10, cached_input_tokens: 3, output_tokens: 4 },
      actions: [{
        type: 'whatsapp',
        label: '+34 000 000 000',
        href: 'https://wa.me/34000000000',
      }],
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
      time_zone: 'Europe/Madrid',
      conversation_context: [
        { role: 'user', content: '¿Tenéis descuentos?' },
        { role: 'assistant', content: 'Sí. Las personas jubiladas tienen una tarifa de 15 €.' },
      ],
      pending_clarification: {
        intent: 'pricing',
        reason: 'ambiguous_price_intent',
        option_keys: ['tickets', 'plans'],
        options: ['entradas', 'planes'],
      },
      previous_resolution: {
        version: 1,
        state: 'needs_clarification',
        clarification_attempts: 1,
        topic: 'precios',
        intent: 'information',
      },
      fallback_language: 'es',
      language: 'es',
      tenant: {
        name: 'Sala Test',
        response_tone: 'close',
        system_prompt: 'Responde como TALIA.',
        fallback_email: 'info@example.test',
        fallback_phone: '+34000000000',
      },
    })
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
        metadata: { response_language: 'es' },
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
          officialWebFallback: true,
        },
      },
    })

    const [, requestInit] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(requestInit?.body)).tenant).toMatchObject({
      fallback_email: 'info@example.test',
      fallback_phone: '+34000000000',
      fallback: {
        custom_message: 'No podemos confirmar esa información.',
        whatsapp_enabled: true,
      },
      official_web: {
        enabled: true,
        allowed_domains: ['example.test'],
      },
    })
  })

  it('preserves Brazilian Portuguese in the talia-ai language contract', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        reply: 'Olá! Como posso ajudar?',
        provider: 'openai',
        metadata: { response_language: 'pt-BR' },
      }),
    }))

    const result = await new TaliaAiChatAgentProvider().respond({
      ...runtimeInput,
      message: 'Quais são os horários?',
      tenant: {
        ...runtimeInput.tenant,
        fallbackLanguage: 'pt-BR',
      },
    })

    const [, requestInit] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      fallback_language: 'pt-BR',
      language: 'pt-BR',
    })
    expect(result).toMatchObject({
      ok: true,
      reply: 'Olá! Como posso ajudar?',
      metadata: { response_language: 'pt-BR' },
    })
  })

  it('rejects talia-ai responses without the canonical response language', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        reply: 'Respuesta sin contrato de idioma',
        provider: 'openai',
      }),
    }))

    const result = await new TaliaAiChatAgentProvider().respond(runtimeInput)

    expect(result).toMatchObject({
      ok: false,
      provider: 'talia-ai',
      status: 502,
      error: 'talia-ai response did not include metadata.response_language',
    })
  })

  it('surfaces talia-ai failures without a fallback provider', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ ok: false, error: 'temporarily_unavailable' }),
    }))

    const provider = createChatAgentProvider()
    const result = await provider.respond(runtimeInput)

    expect(result).toMatchObject({
      ok: false,
      provider: 'talia-ai',
      status: 503,
      error: 'temporarily_unavailable',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
