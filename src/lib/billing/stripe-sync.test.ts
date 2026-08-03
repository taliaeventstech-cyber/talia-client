import { describe, expect, it } from 'vitest'
import { getSubscriptionPeriod, getSubscriptionUsagePeriod } from './stripe-sync'

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

describe('annual subscription usage periods', () => {
  it('keeps annual billing but derives monthly anchored consumption windows', () => {
    const subscription = {
      id: 'sub_yearly',
      status: 'active',
      customer: 'cus_test',
      current_period_start: Date.parse('2026-08-31T15:37:42.000Z') / 1000,
      current_period_end: Date.parse('2027-08-31T15:37:42.000Z') / 1000,
      metadata: { billing_cadence: 'yearly' },
    }

    expect(getSubscriptionUsagePeriod(subscription, new Date('2027-02-15T12:00:00.000Z'))).toEqual({
      startDate: '2027-01-31',
      endDate: '2027-02-28',
      startAt: '2027-01-31T15:37:42.000Z',
      endAt: '2027-02-28T15:37:42.000Z',
    })
  })
})
