import { describe, expect, it } from 'vitest'
import { buildResponseDiagnosticArtifact } from './artifacts'

describe('response diagnostic artifact', () => {
  it('keeps useful trace evidence and removes secret-like metadata', () => {
    const artifact = buildResponseDiagnosticArtifact({
      content: 'No puedo confirmar el horario.',
      createdAt: '2026-09-03T10:00:00.000Z',
      metadata: {
        user_message: '¿A qué hora abre?',
        requested_provider: 'talia-ai',
        source: 'talia-ai',
        model: 'gpt-test',
        response_language: 'es',
        retrieval_status: 'filtered_no_sources',
        low_confidence: true,
        fallback_reason: 'insufficient_evidence',
        retrieval: {
          status: 'filtered_no_sources',
          attempts: [{
            attempt: 0,
            reason: 'initial',
            query: 'horario apertura',
            semantic_query: 'horario apertura',
            retrieved_count: 0,
            selected_count: 0,
            top_score: null,
            status: 'no_matches',
          }],
        },
        agent_metadata: {
          answer_agent_failure: {
            reason: 'insufficient_evidence',
            authorization: 'Bearer private',
          },
          unrelated_private_debug: 'must not be included',
        },
      },
    })

    expect(artifact).toMatchObject({
      response: { question: '¿A qué hora abre?' },
      signals: {
        retrieval_status: 'filtered_no_sources',
        low_confidence: true,
        fallback_reason: 'insufficient_evidence',
      },
      retrieval: {
        attempts: [{ retrieved_count: 0, selected_count: 0 }],
      },
      agent_metadata: {
        answer_agent_failure: {
          reason: 'insufficient_evidence',
          authorization: '[redacted]',
        },
      },
    })
    expect(JSON.stringify(artifact)).not.toContain('unrelated_private_debug')
    expect(JSON.stringify(artifact)).not.toContain('Bearer private')
  })
})
