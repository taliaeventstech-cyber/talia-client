// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { isCronEnabled, isDueForSync } from './automation'

describe('email sync automation scheduling', () => {
  it('keeps cron enabled unless explicitly disabled', () => {
    expect(isCronEnabled({})).toBe(true)
    expect(isCronEnabled({ cron_enabled: true })).toBe(true)
    expect(isCronEnabled({ cron_enabled: false })).toBe(false)
  })

  it('respects the configured sync frequency', () => {
    const now = new Date('2026-05-14T10:00:00.000Z').getTime()

    expect(isDueForSync(null, {}, now)).toBe(true)
    expect(isDueForSync('2026-05-14T09:44:59.000Z', {}, now)).toBe(true)
    expect(isDueForSync('2026-05-14T09:45:01.000Z', {}, now)).toBe(false)
    expect(isDueForSync('2026-05-14T09:00:00.000Z', { sync_frequency_minutes: 240 }, now)).toBe(false)
  })
})
