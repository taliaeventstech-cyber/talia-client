import { describe, expect, it } from 'vitest'
import { normalizeBackstageResponseTracePage } from './backstage-response-traces'

describe('normalizeBackstageResponseTracePage', () => {
  it('normalizes web, email and WhatsApp traces behind one contract', () => {
    const page = normalizeBackstageResponseTracePage({
      items: [
        {
          id: 'web-message',
          channel: 'web',
          conversation_id: 'web-conversation',
          conversation_label: 'web-session',
          content: 'Web answer',
          question: 'Web question',
          created_at: '2026-09-05T12:00:00.000Z',
          status: null,
          metadata: {
            source: 'talia-ai',
            agent_sources: [{ id: 'chunk-1', source_id: 'source-1' }],
          },
          conversation_metadata: { session_feedback: { resolved: true } },
        },
        {
          id: 'email-draft',
          channel: 'email',
          conversation_id: 'email-thread',
          conversation_label: 'Ticket information',
          content: 'Email answer',
          question: 'Email question',
          created_at: '2026-09-05T11:00:00.000Z',
          status: 'generated',
          metadata: {
            source: 'email_agent',
            knowledge_match_count: 2,
            agent_trace: {
              drafter: {
                provider: 'openai',
                requested_provider: 'openai',
                model: 'gpt-5-mini',
              },
            },
          },
          conversation_metadata: {},
        },
        {
          id: 'whatsapp-message',
          channel: 'whatsapp',
          conversation_id: 'whatsapp-conversation',
          conversation_label: 'Richie',
          content: 'WhatsApp answer',
          question: 'WhatsApp question',
          created_at: '2026-09-05T10:00:00.000Z',
          status: 'read',
          metadata: {
            agent: 'whatsapp_agent',
            provider: 'openai',
            source_ids: ['source-2'],
          },
          conversation_metadata: {},
        },
      ],
      count: 3,
      channel_counts: { web: 1, email: 1, whatsapp: 1 },
      metrics: {
        with_sources: 3,
        without_sources: 0,
        low_confidence: 0,
        fallbacks: 0,
        response_positive: 1,
        response_negative: 0,
        session_resolved: 1,
        session_unresolved: 0,
      },
    })

    expect(page.count).toBe(3)
    expect(page.channelCounts).toEqual({ web: 1, email: 1, whatsapp: 1 })
    expect(page.items.map((item) => item.channel)).toEqual(['web', 'email', 'whatsapp'])

    expect(page.items[0].metadata).toMatchObject({
      user_message: 'Web question',
      retrieval_status: 'sources_used',
    })
    expect(page.items[1].metadata).toMatchObject({
      source: 'openai',
      requested_provider: 'openai',
      model: 'gpt-5-mini',
      user_message: 'Email question',
      retrieval_status: 'sources_used',
    })
    expect(page.items[2].metadata).toMatchObject({
      source: 'openai',
      user_message: 'WhatsApp question',
      retrieval_status: 'sources_used',
      agent_sources: [{ id: 'source-2', source_id: 'source-2', source_type: null, score: null }],
    })
  })

  it('uses safe defaults for optional aggregate data', () => {
    const page = normalizeBackstageResponseTracePage({ items: [], count: -1 })

    expect(page.count).toBe(0)
    expect(page.channelCounts).toEqual({ web: 0, email: 0, whatsapp: 0 })
    expect(page.metrics).toEqual({
      withSources: 0,
      withoutSources: 0,
      lowConfidence: 0,
      fallbacks: 0,
      responsePositive: 0,
      responseNegative: 0,
      sessionResolved: 0,
      sessionUnresolved: 0,
    })
  })
})
