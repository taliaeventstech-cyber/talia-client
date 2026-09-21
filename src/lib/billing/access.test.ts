import { describe, expect, it } from 'vitest'
import { createTrialMetadata, getBillingAccess } from './access'
import { FREE_TRIAL_DAYS } from './plans'

describe('free trial duration', () => {
  it('creates new trials lasting exactly 7 days', () => {
    const startedAt = new Date('2026-08-02T10:00:00.000Z')
    const metadata = createTrialMetadata(startedAt)

    expect(FREE_TRIAL_DAYS).toBe(7)
    expect(metadata.trial_days).toBe(7)
    expect(metadata.trial_ends_at).toBe('2026-08-09T10:00:00.000Z')
  })

  it('uses 7 days when legacy metadata has no explicit end date', () => {
    const access = getBillingAccess({
      source: 'tenant',
      accountStatus: 'trialing',
      accountCreatedAt: '2026-08-02T10:00:00.000Z',
      accountMetadata: {},
      now: new Date('2026-08-02T10:00:00.000Z'),
    })

    expect(access.trialEndsAt).toBe('2026-08-09T10:00:00.000Z')
    expect(access.trialDaysRemaining).toBe(7)
    expect(access.isTrialing).toBe(true)
  })
})
