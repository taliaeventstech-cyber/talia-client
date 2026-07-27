import { describe, expect, it } from 'vitest'
import { buildResponseTraceExport, buildResponseTraceFilename } from './response-trace-export'

describe('response trace export', () => {
  it('builds a versioned, shareable trace without flattening RAG detail', () => {
    const trace = buildResponseTraceExport({
      exportedAt: '2026-07-27T17:00:00.000Z',
      venue: { id: 'tenant-1', name: 'Olympia' },
      response: {
        message_id: 'message-1',
        conversation_id: 'conversation-1',
        created_at: '2026-07-27T16:59:00.000Z',
        question: 'Is the theater accessible?',
        answer: 'Yes, the theater is accessible.',
      },
      provider: { requested: 'talia-ai', used: 'talia-ai', model: 'gpt-4o-mini' },
      language: {
        response_language: 'en',
        agent: { requested_language: 'en', fallback_language: 'es' },
      },
      retrieval: {
        status: 'sources_used',
        low_confidence: false,
        fallback_reason: null,
        sources: [{ source_id: 'source-1', score: 0.81 }],
        chunks: [{ id: 'chunk-1', preview: 'El teatro es accesible.' }],
        context_assembly: { selected_count: 1 },
      },
      feedback: { response: null, session: null },
      metadata: { response_language: 'en' },
    })

    expect(trace).toMatchObject({
      schema_version: 'talia.response_trace.v1',
      exported_at: '2026-07-27T17:00:00.000Z',
      response: { question: 'Is the theater accessible?' },
      retrieval: {
        sources: [{ source_id: 'source-1', score: 0.81 }],
        chunks: [{ id: 'chunk-1', preview: 'El teatro es accesible.' }],
      },
    })
  })

  it('creates a filesystem-safe filename', () => {
    expect(buildResponseTraceFilename(
      '2026-07-27T16:59:00.000Z',
      '5fbf4408-79b9-4f72-821f-6bb16644f613',
    )).toBe('talia-response-trace_2026-07-27_16-59-00_5fbf4408-79b.json')
  })
})
