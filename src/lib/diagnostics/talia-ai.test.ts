// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDiagnosticWithTaliaAi } from './talia-ai'

const report = {
  schema_version: 'talia.diagnostic_report.v1',
  generated_at: '2026-09-03T10:00:00.000Z',
  artifact_type: 'response_trace',
  artifact_id: 'message-1',
  summary: 'No se encontró evidencia suficiente.',
  classification: 'knowledge_gap',
  confidence: 'high',
  findings: [],
  knowledge_review: {
    status: 'completed',
    query: '¿En qué idioma es L’Estanquera del Raval?',
    sources_reviewed: 2,
    source_ids: ['generic-language-faq', 'event-page'],
  },
  discrepancies: [],
  recommended_actions: [],
  limitations: [],
}

const usage = {
  request_count: 1,
  input_tokens: 20,
  cached_input_tokens: 5,
  output_tokens: 10,
}

const usageComponents = [{
  component: 'diagnostic_agent',
  provider: 'openai',
  model: 'gpt-test',
  request_count: 1,
  input_tokens: 20,
  cached_input_tokens: 5,
  output_tokens: 10,
}]

describe('analyzeDiagnosticWithTaliaAi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete process.env.TALIA_AI_BASE_URL
    delete process.env.TALIA_AI_INTERNAL_API_KEY
  })

  it('sends the sanitized artifact over the internal server-to-server contract', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'internal-secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      report,
      provider: 'openai',
      model: 'gpt-test',
      usage,
      usage_components: usageComponents,
    }), { status: 200 })))

    const result = await analyzeDiagnosticWithTaliaAi({
      tenantId: '00000000-0000-4000-8000-000000000001',
      artifactType: 'response_trace',
      artifactId: 'message-1',
      artifact: { retrieval_status: 'filtered_no_sources' },
    })

    expect(result).toMatchObject({
      ok: true,
      analysis: {
        report: { classification: 'knowledge_gap' },
        model: 'gpt-test',
        usage,
        usageComponents,
      },
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://talia-ai.example.test/v1/diagnostics/analyze',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: 'Bearer internal-secret' }),
      }),
    )
  })

  it('rejects malformed reports without exposing provider details', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'internal-secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      report: { summary: 'incomplete' },
      provider: 'openai',
      model: 'gpt-test',
      usage,
      usage_components: usageComponents,
    }), { status: 200 })))

    await expect(analyzeDiagnosticWithTaliaAi({
      tenantId: '00000000-0000-4000-8000-000000000001',
      artifactType: 'response_trace',
      artifactId: 'message-1',
      artifact: {},
    })).resolves.toEqual({
      ok: false,
      error: 'TALIA AI devolvió un diagnóstico con un formato no válido.',
    })
  })
})
