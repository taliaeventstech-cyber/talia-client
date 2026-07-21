// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { isAuthorizedRetentionRequest } from './route'

const CRON_SECRET = 'cron-secret-with-at-least-32-characters'
const INTERNAL_KEY = 'internal-key-with-at-least-32-characters'

describe('data retention cron authorization', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('accepts the dedicated cron bearer secret', () => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
    expect(isAuthorizedRetentionRequest(request({ authorization: `Bearer ${CRON_SECRET}` }))).toBe(true)
  })

  it('accepts the internal key in either supported server-to-server header', () => {
    vi.stubEnv('INTERNAL_API_KEY', INTERNAL_KEY)
    expect(isAuthorizedRetentionRequest(request({ authorization: `Bearer ${INTERNAL_KEY}` }))).toBe(true)
    expect(isAuthorizedRetentionRequest(request({ 'x-talia-internal-key': INTERNAL_KEY }))).toBe(true)
  })

  it('fails closed without a sufficiently long matching secret', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('INTERNAL_API_KEY', 'too-short')
    expect(isAuthorizedRetentionRequest(request())).toBe(false)
    expect(isAuthorizedRetentionRequest(request({ 'x-talia-internal-key': 'too-short' }))).toBe(false)
  })
})

function request(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/data-retention', { headers })
}
