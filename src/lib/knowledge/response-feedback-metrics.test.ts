import { describe, expect, it } from 'vitest'
import { getResponseFeedbackMetrics } from './response-feedback-metrics'

describe('response feedback metrics', () => {
  it('calculates accuracy only from rated responses and reports coverage', () => {
    expect(getResponseFeedbackMetrics({
      positiveCount: 8,
      negativeCount: 2,
      totalCount: 40,
    })).toEqual({
      accuracyPercent: 80,
      coveragePercent: 25,
      positiveCount: 8,
      negativeCount: 2,
      ratedCount: 10,
      totalCount: 40,
    })
  })

  it('does not claim accuracy when no response has been rated', () => {
    expect(getResponseFeedbackMetrics({
      positiveCount: 0,
      negativeCount: 0,
      totalCount: 12,
    })).toEqual({
      accuracyPercent: null,
      coveragePercent: 0,
      positiveCount: 0,
      negativeCount: 0,
      ratedCount: 0,
      totalCount: 12,
    })
  })

  it('normalizes invalid counts and caps inconsistent coverage', () => {
    expect(getResponseFeedbackMetrics({
      positiveCount: 7.9,
      negativeCount: -2,
      totalCount: 3,
    })).toMatchObject({
      accuracyPercent: 100,
      coveragePercent: 100,
      positiveCount: 7,
      negativeCount: 0,
      ratedCount: 7,
      totalCount: 3,
    })
  })
})
