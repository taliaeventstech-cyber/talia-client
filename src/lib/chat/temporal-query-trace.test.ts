import { describe, expect, it } from 'vitest'
import { summarizeTemporalQueryTrace } from './temporal-query-trace'

describe('summarizeTemporalQueryTrace', () => {
  it('keeps the bounded temporal decision and rejected evidence', () => {
    expect(summarizeTemporalQueryTrace({
      status: 'resolved',
      target_month: 9,
      target_year: 2026,
      source: 'nearest_future_month',
      reference_date: '2026-08-07',
      rejected_count: 1,
      rejected: [{ id: 'de-goce-2024', reason: 'year_mismatch', years: [2024] }],
    })).toEqual({
      status: 'resolved',
      target_month: 9,
      target_year: 2026,
      source: 'nearest_future_month',
      reference_date: '2026-08-07',
      rejected_count: 1,
      rejected: [{ id: 'de-goce-2024', reason: 'year_mismatch', years: [2024] }],
    })
  })

  it('rejects malformed trace metadata', () => {
    expect(summarizeTemporalQueryTrace({ status: 'invalid' })).toBeNull()
    expect(summarizeTemporalQueryTrace(null)).toBeNull()
  })
})
