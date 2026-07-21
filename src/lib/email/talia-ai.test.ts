import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmailAgentClassification, EmailAgentInput } from './agent-provider'
import { TaliaAiEmailClassifierProvider, TaliaAiEmailDrafterProvider } from './talia-ai'

const input: EmailAgentInput = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  connectionId: 'connection-1',
  threadId: 'thread-1',
  messageId: 'message-1',
  mailboxEmail: 'info@tenant.test',
  subject: 'Horarios',
  senderEmail: 'visitor@example.com',
  senderName: 'Visitor',
  bodyText: '¿A qué hora abrís?',
  fallbackEmail: 'info@tenant.test',
  fallbackPhone: '+34600111222',
  knowledgeHints: [{ question: 'Horario', answer: 'Abrimos a las 10.', category: 'horarios', priority: 10 }],
  agentSettings: {
    tone: 'professional_cercano',
    draftStyle: 'breve',
    signature: 'Equipo',
    channelPrompt: null,
    classificationTopics: ['horarios', 'otro'],
    humanReviewTopics: [],
    classificationRules: null,
  },
}

const classification: EmailAgentClassification = {
  shouldProcess: true,
  shouldGenerateDraft: true,
  needsHumanReview: false,
  classificationReason: 'visitor_question',
  topic: 'horarios',
  priority: 'normal',
  confidence: 0.91,
  escalationReason: null,
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.TALIA_AI_BASE_URL
  delete process.env.TALIA_AI_INTERNAL_API_KEY
})

describe('TALIA AI email providers', () => {
  it('returns a configuration error without server credentials', async () => {
    const provider = new TaliaAiEmailClassifierProvider()

    await expect(provider.classify(input)).resolves.toEqual({
      ok: false,
      status: 503,
      error: 'TALIA AI service is not configured',
    })
  })

  it('sends the classifier contract server-to-server and parses the decision', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        classification: {
          should_process: true,
          should_generate_draft: true,
          needs_human_review: false,
          classification_reason: 'visitor_question',
          topic: 'horarios',
          priority: 'normal',
          confidence: 0.91,
          escalation_reason: null,
        },
        metadata: { provider: 'talia-ai', side_effects: 'none' },
      }),
    })
    const provider = new TaliaAiEmailClassifierProvider({
      baseUrl: 'https://talia-ai.example.test/',
      apiKey: 'secret',
      fetcher,
    })

    const result = await provider.classify(input)

    expect(result).toMatchObject({
      ok: true,
      classification: {
        shouldProcess: true,
        shouldGenerateDraft: true,
        topic: 'horarios',
        raw: { provider: 'talia-ai' },
      },
    })
    const [, request] = fetcher.mock.calls[0]
    expect(fetcher).toHaveBeenCalledWith(
      'https://talia-ai.example.test/v1/email/classify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      }),
    )
    expect(JSON.parse(String(request.body))).toMatchObject({
      tenant_id: input.tenantId,
      body_text: input.bodyText,
      agent_settings: {
        draft_style: 'breve',
        classification_topics: ['horarios', 'otro'],
      },
    })
  })

  it('sends the authoritative classification when requesting a draft', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        draft: {
          should_generate_draft: true,
          subject: 'Re: Horarios',
          body_text: 'Abrimos a las 10.',
          body_html: null,
          topic: 'horarios',
          priority: 'normal',
          confidence: 0.88,
          escalation_reason: null,
          classification_reason: 'visitor_question',
        },
      }),
    })
    const provider = new TaliaAiEmailDrafterProvider({
      baseUrl: 'https://talia-ai.example.test',
      apiKey: 'secret',
      fetcher,
    })

    const result = await provider.generateDraft({ ...input, classification })

    expect(result).toMatchObject({
      ok: true,
      draft: { bodyText: 'Abrimos a las 10.', topic: 'horarios' },
    })
    const [, request] = fetcher.mock.calls[0]
    expect(JSON.parse(String(request.body))).toMatchObject({
      classification: {
        should_process: true,
        should_generate_draft: true,
        classification_reason: 'visitor_question',
      },
    })
  })

  it('surfaces talia-ai failures without invoking another provider', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({
        ok: false,
        error: 'Failure processing person@example.com',
        details: 'email body and bearer secret must not persist',
        error_code: 'provider_unavailable',
        request_id: 'req-safe-123',
      }),
    })
    const provider = new TaliaAiEmailClassifierProvider({
      baseUrl: 'https://talia-ai.example.test',
      apiKey: 'secret',
      fetcher,
    })

    await expect(provider.classify(input)).resolves.toEqual({
      ok: false,
      status: 503,
      error: 'talia-ai email request failed with status 503',
      details: '{"status":503,"error_code":"provider_unavailable","request_id":"req-safe-123"}',
    })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('does not retain a raw response when talia-ai returns invalid JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'person@example.com bearer-secret raw email body',
    })
    const provider = new TaliaAiEmailClassifierProvider({
      baseUrl: 'https://talia-ai.example.test',
      apiKey: 'secret',
      fetcher,
    })

    const result = await provider.classify(input)

    expect(result).toEqual({
      ok: false,
      status: 502,
      error: 'talia-ai returned invalid JSON',
      details: '{"status":502,"error_code":"invalid_json","request_id":null}',
    })
    expect(JSON.stringify(result)).not.toContain('person@example.com')
    expect(JSON.stringify(result)).not.toContain('bearer-secret')
    expect(JSON.stringify(result)).not.toContain('raw email body')
  })
})
