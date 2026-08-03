import { describe, expect, it } from 'vitest'
import { getSubscriptionPeriod } from './stripe-sync'

describe('getSubscriptionPeriod', () => {
  it('preserves Stripe period boundaries as exact UTC instants', () => {
    const period = getSubscriptionPeriod({
      id: 'sub_test',
      status: 'active',
      customer: 'cus_test',
      current_period_start: Date.parse('2026-08-02T15:37:42.000Z') / 1000,
      current_period_end: Date.parse('2026-09-02T15:37:42.000Z') / 1000,
    })

    expect(period).toEqual({
      startDate: '2026-08-02',
      endDate: '2026-09-02',
      startAt: '2026-08-02T15:37:42.000Z',
      endAt: '2026-09-02T15:37:42.000Z',
    })
  })
})
