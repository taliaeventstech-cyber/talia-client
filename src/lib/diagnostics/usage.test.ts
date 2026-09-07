import { describe, expect, it, vi } from 'vitest'
import { recordDiagnosticUsage } from './usage'

const analysis = {
  provider: 'openai',
  model: 'gpt-test',
  usage: {
    request_count: 2,
    input_tokens: 28,
    cached_input_tokens: 5,
    output_tokens: 10,
  },
  usageComponents: [{
    component: 'diagnostic_agent' as const,
    provider: 'openai',
    model: 'gpt-test',
    request_count: 1,
    input_tokens: 20,
    cached_input_tokens: 5,
    output_tokens: 10,
  }, {
    component: 'retrieval_embedding' as const,
    provider: 'openai',
    model: 'text-embedding-test',
    request_count: 1,
    input_tokens: 8,
    cached_input_tokens: 0,
    output_tokens: 0,
  }],
  report: {
    schema_version: 'talia.diagnostic_report.v1' as const,
    generated_at: '2026-09-03T10:00:00.000Z',
    artifact_type: 'response_trace' as const,
    artifact_id: '00000000-0000-4000-8000-000000000002',
    summary: 'No se encontró evidencia suficiente.',
    classification: 'knowledge_gap' as const,
    confidence: 'high' as const,
    findings: [],
    knowledge_review: {
      status: 'completed' as const,
      query: '¿En qué idioma es L’Estanquera del Raval?',
      sources_reviewed: 2,
      source_ids: ['generic-language-faq', 'event-page'],
    },
    discrepancies: [],
    recommended_actions: [],
    limitations: [],
  },
}

describe('recordDiagnosticUsage', () => {
  it('records aggregate and precise diagnostic model usage', async () => {
    const recordUsageEvent = vi.fn(async () => ({
      ok: true as const,
      duplicate: false,
      eventId: 'usage-event-1',
    }))
    const recordMeasuredAiUsage = vi.fn(async () => ({ ok: true as const, inserted: 1 }))

    await recordDiagnosticUsage({} as never, {
      tenantId: '00000000-0000-4000-8000-000000000001',
      artifactType: 'response_trace',
      artifactId: '00000000-0000-4000-8000-000000000002',
      diagnosticRunId: 'diagnostic-run-1',
      analysis,
    }, { recordUsageEvent, recordMeasuredAiUsage })

    expect(recordUsageEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      channel: 'backstage',
      eventType: 'ai_call',
      inputTokens: 28,
      outputTokens: 10,
      idempotencyKey: 'backstage-diagnostic:diagnostic-run-1:ai_call',
    }))
    expect(recordMeasuredAiUsage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyPrefix: 'backstage-diagnostic:diagnostic-run-1:component',
      components: [{
        component: 'diagnostic_agent',
        provider: 'openai',
        model: 'gpt-test',
        request_count: 1,
        input_tokens: 20,
        cached_input_tokens: 5,
        output_tokens: 10,
      }, {
        component: 'retrieval_embedding',
        provider: 'openai',
        model: 'text-embedding-test',
        request_count: 1,
        input_tokens: 8,
        cached_input_tokens: 0,
        output_tokens: 0,
      }],
    }))
  })
})
