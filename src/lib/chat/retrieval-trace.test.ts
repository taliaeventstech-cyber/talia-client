import { describe, expect, it } from 'vitest'
import { summarizeRetrievalTrace } from './retrieval-trace'

describe('retrieval trace summary', () => {
  it('preserves bounded conversational retrieval attempts for Backstage debugging', () => {
    const trace = summarizeRetrievalTrace({
      retrieval: {
        status: 'sources_used',
        query_language: 'es',
        retrieval_query: 'comprar entradas tickets',
        top_score: 0.91,
        refinement_used: true,
        attempts: [
          {
            attempt: 0,
            reason: 'initial',
            query: 'comprar entradas tickets',
            semantic_query: '¿Cómo comprar entradas?',
            retrieved_count: 5,
            selected_count: 5,
            top_score: 0.71,
            status: 'completed',
          },
          {
            attempt: 1,
            reason: 'missing_evidence',
            query: 'procedimiento oficial y enlace para comprar entradas',
            semantic_query: 'procedimiento oficial y enlace para comprar entradas',
            retrieved_count: 2,
            selected_count: 5,
            top_score: 0.91,
            status: 'completed',
          },
        ],
        chunks: [{
          id: 'ticket-guide',
          source_id: 'official-pdf',
          source_type: 'pdf',
          score: 0.91,
          rank: 1,
          used: true,
          language: 'es',
          preview: 'Las entradas se compran online.',
        }],
      },
    })

    expect(trace).toMatchObject({
      status: 'sources_used',
      retrieval_query: 'comprar entradas tickets',
      refinement_used: true,
      attempts: [
        { attempt: 0, reason: 'initial', retrieved_count: 5 },
        { attempt: 1, reason: 'missing_evidence', retrieved_count: 2 },
      ],
      chunks: [{ id: 'ticket-guide', used: true }],
    })
  })

  it('drops malformed attempts instead of persisting unbounded provider metadata', () => {
    const trace = summarizeRetrievalTrace({
      retrieval: {
        attempts: [{
          attempt: 99,
          reason: 'invalid',
          query: 'query',
          semantic_query: 'query',
          retrieved_count: 1,
          selected_count: 1,
          status: 'completed',
        }],
      },
    })

    expect(trace?.attempts).toEqual([])
    expect(trace?.refinement_used).toBe(false)
  })
})
