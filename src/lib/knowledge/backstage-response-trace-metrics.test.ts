import { describe, expect, it } from 'vitest'
import { normalizeBackstageResponseTraceMetrics } from './backstage-response-trace-metrics'

describe('normalizeBackstageResponseTraceMetrics', () => {
  it('keeps the global totals returned by the trace aggregate', () => {
    expect(normalizeBackstageResponseTraceMetrics({
      with_sources: 107,
      without_sources: 21,
      low_confidence: 8,
      fallbacks: 4,
      response_positive: 17,
      response_negative: 15,
      session_resolved: 12,
      session_unresolved: 3,
    })).toEqual({
      withSources: 107,
      withoutSources: 21,
      lowConfidence: 8,
      fallbacks: 4,
      responsePositive: 17,
      responseNegative: 15,
      sessionResolved: 12,
      sessionUnresolved: 3,
    })
  })
})
