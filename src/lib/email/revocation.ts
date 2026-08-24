import { decryptOAuthTokens, revokeGoogleOAuthToken } from './google-oauth'
import { logSafeEmailError } from './safe-error'

export async function revokeEmailConnectionToken(provider: string, oauthMetadata: unknown) {
  try {
    if (provider !== 'google') return null

    const metadata = oauthMetadata && typeof oauthMetadata === 'object'
      ? oauthMetadata as Record<string, unknown>
      : {}
    const tokens = decryptOAuthTokens(metadata.encrypted_tokens)
    const tokenToRevoke = tokens.refresh_token ?? tokens.access_token

    if (!tokenToRevoke) return 'revocable_token_not_found'

    await revokeGoogleOAuthToken(tokenToRevoke)
    return null
  } catch (error) {
    logSafeEmailError('email_disconnect_revocation_failed', error, 'token_revocation_failed')
    return 'token_revocation_failed'
  }
}

export type AccountEmailConnection = {
  id: string
  provider: string
  status: string
  oauth_metadata: unknown
}

export async function revokeEmailConnectionsBeforeAccountDeletion(
  connections: AccountEmailConnection[],
  markRevoked: (connectionId: string) => Promise<void>,
) {
  for (const connection of connections) {
    if (connection.status === 'revoked') continue

    const revokeError = await revokeEmailConnectionToken(
      connection.provider,
      connection.oauth_metadata,
    )
    if (revokeError) {
      return { ok: false as const, errorCode: revokeError }
    }

    try {
      await markRevoked(connection.id)
    } catch (error) {
      logSafeEmailError(
        'account_deletion_oauth_cleanup_failed',
        error,
        'local_token_removal_failed',
      )
      return { ok: false as const, errorCode: 'local_token_removal_failed' }
    }
  }

  return { ok: true as const }
}
