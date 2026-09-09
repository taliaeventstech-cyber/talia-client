// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { assertEmailOAuthInitiator } from './oauth-session'

describe('assertEmailOAuthInitiator', () => {
  it('accepts the user who initiated the OAuth flow', () => {
    expect(() => assertEmailOAuthInitiator('user-1', 'user-1')).not.toThrow()
  })

  it('rejects a different user, including another platform operator', () => {
    expect(() => assertEmailOAuthInitiator('platform-user-2', 'platform-user-1'))
      .toThrow('OAuth session does not match the initiating user')
  })
})
