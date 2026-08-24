import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptOAuthTokens, revokeGoogleOAuthToken } from './google-oauth'
import {
  revokeEmailConnectionsBeforeAccountDeletion,
  revokeEmailConnectionToken,
} from './revocation'

vi.mock('./google-oauth', () => ({
  decryptOAuthTokens: vi.fn(),
  revokeGoogleOAuthToken: vi.fn(),
}))

vi.mock('./safe-error', () => ({
  logSafeEmailError: vi.fn(),
}))

describe('email OAuth revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers the Google refresh token for revocation', async () => {
    vi.mocked(decryptOAuthTokens).mockReturnValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })

    await expect(revokeEmailConnectionToken('google', {
      encrypted_tokens: { ciphertext: 'encrypted' },
    })).resolves.toBeNull()

    expect(revokeGoogleOAuthToken).toHaveBeenCalledWith('refresh-token')
  })

  it('does not inspect Google token material for a non-Google provider', async () => {
    await expect(revokeEmailConnectionToken('microsoft', {})).resolves.toBeNull()
    expect(decryptOAuthTokens).not.toHaveBeenCalled()
    expect(revokeGoogleOAuthToken).not.toHaveBeenCalled()
  })

  it('revokes active account connections and clears each local token record', async () => {
    vi.mocked(decryptOAuthTokens).mockReturnValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })
    const markRevoked = vi.fn(async () => undefined)

    const result = await revokeEmailConnectionsBeforeAccountDeletion([
      {
        id: 'connection-1',
        provider: 'google',
        status: 'connected',
        oauth_metadata: { encrypted_tokens: { ciphertext: 'encrypted' } },
      },
      {
        id: 'connection-2',
        provider: 'google',
        status: 'revoked',
        oauth_metadata: {},
      },
    ], markRevoked)

    expect(result).toEqual({ ok: true })
    expect(revokeGoogleOAuthToken).toHaveBeenCalledOnce()
    expect(markRevoked).toHaveBeenCalledOnce()
    expect(markRevoked).toHaveBeenCalledWith('connection-1')
  })

  it('blocks account deletion when provider revocation fails', async () => {
    vi.mocked(decryptOAuthTokens).mockImplementation(() => {
      throw new Error('encrypted provider payload must not escape')
    })
    const markRevoked = vi.fn(async () => undefined)

    const result = await revokeEmailConnectionsBeforeAccountDeletion([
      {
        id: 'connection-1',
        provider: 'google',
        status: 'connected',
        oauth_metadata: { encrypted_tokens: { ciphertext: 'encrypted' } },
      },
    ], markRevoked)

    expect(result).toEqual({ ok: false, errorCode: 'token_revocation_failed' })
    expect(markRevoked).not.toHaveBeenCalled()
  })
})
