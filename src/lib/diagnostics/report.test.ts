import { describe, expect, it } from 'vitest'
import { shouldOfferResponseDiagnostic } from './report'

describe('response diagnostic eligibility', () => {
  it.each([
    [true, null],
    [true, 'negative'],
    [false, 'positive'],
  ] as const)('offers diagnostic=%s for rating=%s', (expected, rating) => {
    expect(shouldOfferResponseDiagnostic(rating)).toBe(expected)
  })
})
