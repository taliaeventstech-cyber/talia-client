import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decryptInstagramCredentials,
  encryptInstagramCredentials,
  getInstagramConnectionAccessToken,
} from './credentials'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Instagram connection credentials', () => {
  const credentials = {
    accessToken: 'instagram-long-lived-token',
    tokenType: 'bearer',
    expiresAt: '2026-11-20T10:00:00.000Z',
  }

  it('encrypts and authenticates credentials with a dedicated key', () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'i'.repeat(32))
    const encrypted = encryptInstagramCredentials(credentials)

    expect(encrypted.ciphertext).not.toContain(credentials.accessToken)
    expect(decryptInstagramCredentials(encrypted)).toEqual(credentials)
  })

  it('rejects modified encrypted credentials', () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'i'.repeat(32))
    const encrypted = encryptInstagramCredentials(credentials)

    expect(() => decryptInstagramCredentials({ ...encrypted, tag: 'broken' })).toThrow()
  })

  it('does not fall back to the WhatsApp encryption key', () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', '')
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))

    expect(() => encryptInstagramCredentials(credentials))
      .toThrow('Missing dedicated Instagram token encryption key')
  })

  it('loads and decrypts only a rollout-enabled backend credential envelope', async () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'i'.repeat(32))
    const encrypted = encryptInstagramCredentials(credentials)
    const rpc = vi.fn().mockResolvedValue({
      data: { credential_metadata: { encrypted_credentials: encrypted } },
      error: null,
    })

    await expect(getInstagramConnectionAccessToken({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      instagramUserId: '17841400000000000',
    })).resolves.toBe(credentials.accessToken)

    expect(rpc).toHaveBeenCalledWith('get_instagram_connection_credentials', {
      p_theatre_id: '10000000-0000-4000-8000-000000000001',
      p_instagram_user_id: '17841400000000000',
    })
  })
})
