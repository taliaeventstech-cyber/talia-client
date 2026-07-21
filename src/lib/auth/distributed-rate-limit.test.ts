import { afterEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc }),
}))

import { consumeRateLimit } from './security'

describe('distributed security rate limits', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('stores an HMAC digest instead of the raw identifier in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RATE_LIMIT_HASH_SECRET', 'a-secure-rate-limit-secret-with-32-characters')
    rpc.mockResolvedValue({
      data: [{ allowed: true, remaining: 7, retry_after_seconds: 300 }],
      error: null,
    })

    await expect(consumeRateLimit([{
      key: 'auth-login:email:person@example.com',
      limit: 8,
    }])).resolves.toBeNull()

    expect(rpc).toHaveBeenCalledWith('consume_security_rate_limit', expect.objectContaining({
      p_scope: 'auth-login',
      p_key_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_limit: 8,
      p_window_seconds: 300,
    }))
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('person@example.com')
  })

  it('fails closed when the distributed counter is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RATE_LIMIT_HASH_SECRET', 'a-secure-rate-limit-secret-with-32-characters')
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })

    await expect(consumeRateLimit([{
      key: 'chat-minute:tenant-1:203.0.113.10',
      limit: 30,
    }])).resolves.toEqual({ retryAfterSeconds: 1, unavailable: true })
  })

  it('fails closed when production has no hashing secret', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RATE_LIMIT_HASH_SECRET', '')
    vi.stubEnv('INTERNAL_API_KEY', '')

    await expect(consumeRateLimit([{
      key: 'auth-login:ip:203.0.113.10',
      limit: 20,
    }])).resolves.toEqual({ retryAfterSeconds: 1, unavailable: true })
    expect(rpc).not.toHaveBeenCalled()
  })
})
