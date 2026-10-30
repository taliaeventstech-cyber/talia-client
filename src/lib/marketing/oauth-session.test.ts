import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPendingMetaMarketingOAuthSession,
  parsePendingMetaMarketingOAuthSession,
} from './oauth-session'

const input = {
  tenantId: '657c9c3e-bf4a-45ce-868d-45a2f48db2fb',
  userId: '0d423c31-f1cb-49a4-9b23-6876c1f06e19',
  metaUserId: 'meta-user-1',
  accessToken: 'sensitive-access-token',
  tokenType: 'bearer',
  tokenExpiresAt: '2026-12-04T10:00:00.000Z',
  scopes: ['ads_read', 'ads_management', 'business_management'],
}

describe('pending Meta Marketing OAuth session', () => {
  beforeEach(() => {
    vi.stubEnv(
      'META_MARKETING_TOKEN_ENCRYPTION_KEY',
      'encryption-key-that-is-at-least-32-characters',
    )
  })

  afterEach(() => vi.unstubAllEnvs())

  it('round-trips an encrypted, time-limited session', () => {
    const createdAt = Date.parse('2026-10-05T10:00:00.000Z')
    const cookie = createPendingMetaMarketingOAuthSession(input, createdAt)

    expect(cookie).not.toContain(input.accessToken)
    expect(parsePendingMetaMarketingOAuthSession(cookie, createdAt + 1_000)).toMatchObject(input)
  })

  it('rejects a modified encrypted session', () => {
    const cookie = createPendingMetaMarketingOAuthSession(input)
    const encrypted = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8'))
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64url')
    ciphertext[0] ^= 0xff
    encrypted.ciphertext = ciphertext.toString('base64url')
    const tampered = Buffer.from(JSON.stringify(encrypted), 'utf8').toString('base64url')

    expect(() => parsePendingMetaMarketingOAuthSession(tampered)).toThrow()
  })

  it('rejects an expired session', () => {
    const createdAt = Date.parse('2026-10-05T10:00:00.000Z')
    const cookie = createPendingMetaMarketingOAuthSession(input, createdAt)

    expect(() => parsePendingMetaMarketingOAuthSession(
      cookie,
      createdAt + 15 * 60 * 1000 + 1,
    )).toThrow('meta_marketing_oauth_session_expired')
  })
})
