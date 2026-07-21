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
    vi.stubEnv('CRON_SECRET', 'cron-secret-with-at-least-32-characters')
    vi.stubEnv('INTERNAL_API_KEY', 'internal-secret-with-at-least-32-characters')

    expect(isAuthorizedCronRequest(requestWithBearer('cron-secret-with-at-least-32-characters'))).toBe(true)
    expect(isAuthorizedCronRequest(requestWithBearer('internal-secret-with-at-least-32-characters'))).toBe(false)
    expect(isAuthorizedCronRequest(new NextRequest('http://localhost/api/cron/email/sync'))).toBe(false)
  })

  it('fails closed when local development has no configured secret', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CRON_SECRET', '')

    expect(isAuthorizedCronRequest(new NextRequest('http://localhost/api/cron/email/sync'))).toBe(false)
  })

  it('rejects configured secrets shorter than 32 characters', () => {
    vi.stubEnv('CRON_SECRET', 'too-short')
    expect(isAuthorizedCronRequest(requestWithBearer('too-short'))).toBe(false)
  })
})

function requestWithBearer(token: string) {
  return new NextRequest('http://localhost/api/cron/email/sync', {
    headers: { authorization: `Bearer ${token}` },
  })
}
