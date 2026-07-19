import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGoogleOAuthState,
  decryptOAuthTokens,
  encryptOAuthTokens,
  verifyGoogleOAuthState,
} from './google-oauth'

const TOKEN_SECRET = 'token-secret-with-at-least-32-characters'
const STATE_SECRET = 'state-secret-with-at-least-32-characters'

describe('Google OAuth security', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('encrypts tokens with authenticated encryption and decrypts them', () => {
    vi.stubEnv('EMAIL_TOKEN_ENCRYPTION_KEY', TOKEN_SECRET)
    const encrypted = encryptOAuthTokens({ access_token: 'access', refresh_token: 'refresh' })

    expect(encrypted.alg).toBe('aes-256-gcm')
    expect(JSON.stringify(encrypted)).not.toContain('refresh')
    expect(decryptOAuthTokens(encrypted)).toMatchObject({
      access_token: 'access',
      refresh_token: 'refresh',
    })
  })

  it('rejects token encryption without a dedicated sufficiently long secret', () => {
    vi.stubEnv('EMAIL_TOKEN_ENCRYPTION_KEY', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-that-must-not-be-reused')

    expect(() => encryptOAuthTokens({ access_token: 'access' }))
      .toThrow('Missing dedicated email token encryption key')
  })

  it('signs, verifies and rejects tampered OAuth state', () => {
    vi.stubEnv('EMAIL_OAUTH_STATE_SECRET', STATE_SECRET)
    const state = createGoogleOAuthState({ tenantId: 'tenant', userId: 'user' })

    expect(verifyGoogleOAuthState(state)).toMatchObject({ tenantId: 'tenant', userId: 'user' })
    expect(() => verifyGoogleOAuthState(`${state.slice(0, -1)}x`))
      .toThrow('Invalid OAuth state signature')
  })

  it('does not fall back to the Supabase service-role key for state signing', () => {
    vi.stubEnv('EMAIL_OAUTH_STATE_SECRET', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-that-must-not-be-reused')

    expect(() => createGoogleOAuthState({ tenantId: 'tenant', userId: 'user' }))
      .toThrow('Missing dedicated email OAuth state secret')
  })
})
