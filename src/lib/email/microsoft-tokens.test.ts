import { describe, expect, it, vi } from 'vitest'
import {
  decryptOAuthTokens,
  encryptOAuthTokens,
  refreshMicrosoftAccessToken,
} from './microsoft-oauth'
import { getFreshMicrosoftAccessToken } from './microsoft-tokens'

vi.mock('./microsoft-oauth', () => ({
  decryptOAuthTokens: vi.fn(),
  encryptOAuthTokens: vi.fn(),
  refreshMicrosoftAccessToken: vi.fn(),
}))

describe('getFreshMicrosoftAccessToken', () => {
  it('fails safely when the refreshed token set cannot be persisted', async () => {
    vi.mocked(decryptOAuthTokens).mockReturnValue({
      access_token: 'expired-access',
      refresh_token: 'refresh-token',
    })
    vi.mocked(refreshMicrosoftAccessToken).mockResolvedValue({
      access_token: 'new-access',
      expires_in: 3600,
    })
    vi.mocked(encryptOAuthTokens).mockReturnValue({
      alg: 'aes-256-gcm',
      iv: 'iv',
      tag: 'tag',
      ciphertext: 'ciphertext',
    })

    const eq = vi.fn().mockResolvedValue({ error: { message: 'database unavailable' } })
    const update = vi.fn().mockReturnValue({ eq })
    const admin = { from: vi.fn().mockReturnValue({ update }) }

    await expect(getFreshMicrosoftAccessToken(admin as never, {
      id: 'connection-id',
      oauth_metadata: {},
    })).rejects.toThrow('microsoft_token_persistence_failed')
  })
})
