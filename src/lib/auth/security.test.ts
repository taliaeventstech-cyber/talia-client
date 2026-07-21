import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearRateLimitBucketsForTest,
  consumeRateLimit,
  getClientIp,
} from './security'

describe('security rate limits', () => {
  beforeEach(() => {
    clearRateLimitBucketsForTest()
  })

  it('limits a scoped key within the configured local window', async () => {
    const rule = { key: 'chat-minute:tenant-1:203.0.113.10', limit: 2, windowMs: 60_000 }

    await expect(consumeRateLimit([rule])).resolves.toBeNull()
    await expect(consumeRateLimit([rule])).resolves.toBeNull()
    await expect(consumeRateLimit([rule])).resolves.toMatchObject({
      retryAfterSeconds: expect.any(Number),
    })
  })

  it('uses the first forwarded address as the client identifier', () => {
    const request = new Request('https://agora.talia.events', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.4' },
    })

    expect(getClientIp(request)).toBe('203.0.113.10')
  })
})
