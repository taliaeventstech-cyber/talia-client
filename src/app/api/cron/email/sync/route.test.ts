// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { isAuthorizedCronRequest } from './route'

describe('email sync cron authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts only the dedicated cron secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('INTERNAL_API_KEY', 'internal-secret')

    expect(isAuthorizedCronRequest(requestWithBearer('cron-secret'))).toBe(true)
    expect(isAuthorizedCronRequest(requestWithBearer('internal-secret'))).toBe(false)
    expect(isAuthorizedCronRequest(new NextRequest('http://localhost/api/cron/email/sync'))).toBe(false)
  })

  it('allows an unconfigured local development request', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CRON_SECRET', '')

    expect(isAuthorizedCronRequest(new NextRequest('http://localhost/api/cron/email/sync'))).toBe(true)
  })
})

function requestWithBearer(token: string) {
  return new NextRequest('http://localhost/api/cron/email/sync', {
    headers: { authorization: `Bearer ${token}` },
  })
}
