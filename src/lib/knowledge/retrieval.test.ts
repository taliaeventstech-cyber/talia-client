// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRelevantKnowledgeHints, retrieveTenantKnowledge, shouldRetrieveKnowledge } from './retrieval'
import { shouldAnswerFromKnowledge, type KnowledgeMatch } from './service'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete process.env.CHAT_AGENT_PROVIDER
  delete process.env.KNOWLEDGE_RETRIEVAL_PROVIDER
  delete process.env.TALIA_AI_BASE_URL
  delete process.env.TALIA_AI_INTERNAL_API_KEY
})

describe('buildRelevantKnowledgeHints', () => {
  it('keeps source metadata needed by agent runtimes', () => {
    const hints = buildRelevantKnowledgeHints([
      {
        id: 'item-1',
        source_id: 'source-1',
        question: 'Do you have accessible seating?',
        answer: 'Yes, accessible seating is available.',
        category: 'accessibility',
        language: 'en',
        priority: 80,
        metadata: { source_type: 'pdf' },
        score: 12,
      } satisfies KnowledgeMatch,
    ])

    expect(hints).toEqual([
      {
        id: 'item-1',
        sourceId: 'source-1',
        sourceType: 'pdf',
        question: 'Do you have accessible seating?',
        answer: 'Yes, accessible seating is available.',
        category: 'accessibility',
        priority: 80,
        score: 12,
      },
    ])
  })

  it('defaults source type for manual knowledge', () => {
    const hints = buildRelevantKnowledgeHints([
      {
        id: 'item-1',
        source_id: null,
        question: 'Where are you?',
        answer: 'Barcelona.',
        category: null,
        language: 'en',
        priority: 50,
        metadata: null,
        score: 9,
      } satisfies KnowledgeMatch,
    ])

    expect(hints[0]?.sourceType).toBe('knowledge_item')
  })

  it('filters weak context when stronger matches exist', () => {
    const hints = buildRelevantKnowledgeHints([
      createMatch('strong-1', 8),
      createMatch('weak-1', 2),
      createMatch('strong-2', 5),
      createMatch('weak-2', 1),
    ])

    expect(hints.map((hint) => hint.id)).toEqual(['strong-1', 'strong-2'])
  })

  it('keeps the best weak match when no strong context exists', () => {
    const hints = buildRelevantKnowledgeHints([
      createMatch('weak-1', 2),
      createMatch('weak-2', 1),
    ])

    expect(hints.map((hint) => hint.id)).toEqual(['weak-1'])
  })
})

function createMatch(id: string, score: number): KnowledgeMatch {
  return {
    id,
    source_id: 'source-1',
    question: `Question ${id}`,
    answer: `Answer ${id}`,
    category: 'documento',
    language: 'es',
    priority: 45,
    metadata: { source_type: 'pdf' },
    score,
  }
}

describe('shouldAnswerFromKnowledge', () => {
  it('does not answer directly from raw PDF chunks even with a high score', () => {
    expect(shouldAnswerFromKnowledge([
      {
        id: 'chunk-1',
        source_id: 'source-1',
        question: 'Documento importado · fragmento 1',
        answer: 'Pregunta A Respuesta A Pregunta B Respuesta B',
        category: 'documento',
        language: 'es',
        priority: 45,
        metadata: { source_type: 'pdf' },
        score: 14,
      },
    ])).toBe(false)
  })

  it('still answers directly from curated knowledge items with a high score', () => {
    expect(shouldAnswerFromKnowledge([
      {
        id: 'item-1',
        source_id: null,
        question: '¿El teatro es accesible?',
        answer: 'Sí, el teatro tiene acceso sin barreras.',
        category: 'accesibilidad',
        language: 'es',
        priority: 80,
        metadata: null,
        score: 12,
      },
    ])).toBe(true)
  })
})

describe('retrieveTenantKnowledge', () => {
  it('does not run retrieval for pure greetings', async () => {
    process.env.CHAT_AGENT_PROVIDER = 'talia-ai'
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn())

    const result = await retrieveTenantKnowledge({
      admin: {} as Parameters<typeof retrieveTenantKnowledge>[0]['admin'],
      tenantId: '00000000-0000-4000-8000-000000000001',
      query: 'Hola',
      channel: 'web',
      language: 'es',
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      matches: [],
      topMatch: null,
      shouldAnswerDirectly: false,
    })
  })

  it('delegates retrieval to talia-ai when configured', async () => {
    process.env.CHAT_AGENT_PROVIDER = 'talia-ai'
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        matches: [{
          id: 'chunk-1',
          source_id: 'source-1',
          source_type: 'pdf',
          question: 'Documento PDF',
          answer: 'Solo se aceptan perros guia.',
          category: 'documento',
          priority: 45,
          score: 0.8,
          retrieval: 'vector',
          language: 'ca',
        }],
      }),
    }))

    const result = await retrieveTenantKnowledge({
      admin: {} as Parameters<typeof retrieveTenantKnowledge>[0]['admin'],
      tenantId: '00000000-0000-4000-8000-000000000001',
      query: 'Puc entrar amb gos?',
      channel: 'web',
      language: 'ca',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://talia-ai.example.test/v1/knowledge/retrieve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
        }),
      }),
    )
    expect(result.matches[0]).toMatchObject({
      id: 'chunk-1',
      source_id: 'source-1',
      answer: 'Solo se aceptan perros guia.',
      language: 'ca',
      score: 16,
      metadata: {
        source_type: 'pdf',
        remote_provider: 'talia-ai',
        retrieval: 'vector',
        remote_score: 0.8,
      },
    })
  })
})

describe('shouldRetrieveKnowledge', () => {
  it.each(['Hola', 'Buenas', 'Bon dia', 'Gracias', 'ok'])('ignores low-intent message "%s"', (message) => {
    expect(shouldRetrieveKnowledge(message)).toBe(false)
  })

  it.each(['Hola, ¿puedo entrar con perro?', 'Buenas, quiero comprar entradas', 'A quina hora obriu?'])(
    'keeps real knowledge queries with greeting text "%s"',
    (message) => {
      expect(shouldRetrieveKnowledge(message)).toBe(true)
    },
  )
})
