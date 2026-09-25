import { describe, expect, it } from 'vitest'
import { shouldShowConnectedAccountDetails } from './connection-visibility'

describe('shouldShowConnectedAccountDetails', () => {
  it('shows provider account details only while the connection is active', () => {
    expect(shouldShowConnectedAccountDetails('connected')).toBe(true)

    for (const status of [undefined, 'pending', 'error', 'revoked', 'disabled']) {
      expect(shouldShowConnectedAccountDetails(status)).toBe(false)
    }
  })
})
