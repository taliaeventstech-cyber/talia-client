import { describe, expect, it } from 'vitest'
import { buildAiCostMonthlyHistory, getAiCostHistoryStartDate } from './ai-cost-history'

describe('AI cost monthly history', () => {
  it('loads a twelve-month window including the current month', () => {
    expect(getAiCostHistoryStartDate(new Date('2026-08-03T10:00:00Z'))).toBe('2025-09-01')
  })

  it('groups measured usage by month and fills gaps', () => {
    const history = buildAiCostMonthlyHistory([
      usage('2026-06-10', 2, 3, 1_500_000),
      usage('2026-06-28', 1, 2, 500_000),
      usage('2026-08-02', 4, 6, 3_000_000),
    ], new Date('2026-08-03T10:00:00Z'))

    expect(history.map((entry) => entry.month)).toEqual(['2026-08', '2026-07', '2026-06'])
    expect(history[0]).toMatchObject({ responses: 4, requests: 6, costUsdMicros: 3_000_000, isCurrent: true })
    expect(history[1]).toMatchObject({ responses: 0, costUsdMicros: 0, isCurrent: false })
    expect(history[2]).toMatchObject({ responses: 3, requests: 5, costUsdMicros: 2_000_000 })
  })

  it('always returns the current month when there is no measured usage', () => {
    expect(buildAiCostMonthlyHistory([], new Date('2026-08-03T10:00:00Z')))
      .toEqual([expect.objectContaining({ month: '2026-08', isCurrent: true, costUsdMicros: 0 })])
  })
})

function usage(date: string, responses: number, requests: number, costUsdMicros: number) {
  return {
    date,
    response_count: responses,
    request_count: requests,
    input_tokens: 100,
    cached_input_tokens: 20,
    output_tokens: 50,
    cost_usd_micros: costUsdMicros,
  }
}
