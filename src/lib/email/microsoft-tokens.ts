import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import {
  decryptOAuthTokens,
  encryptOAuthTokens,
  refreshMicrosoftAccessToken,
} from './microsoft-oauth'

type AdminClient = ReturnType<typeof createAdminClient>

export async function getFreshMicrosoftAccessToken(
  admin: AdminClient,
  connection: {
    id: string
    oauth_metadata: Json
  },
) {
  const oauthMetadata = getJsonRecord(connection.oauth_metadata)
  const tokens = decryptOAuthTokens(oauthMetadata.encrypted_tokens)

  if (!tokens.refresh_token) {
    return tokens.access_token
  }

  const refreshedTokens = await refreshMicrosoftAccessToken(tokens.refresh_token)
  const mergedTokens = {
    ...tokens,
    ...refreshedTokens,
    refresh_token: refreshedTokens.refresh_token ?? tokens.refresh_token,
  }
  const expiresAt = refreshedTokens.expires_in
    ? new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString()
    : typeof oauthMetadata.expires_at === 'string'
      ? oauthMetadata.expires_at
      : null

  await admin
    .from('email_connections')
    .update({
      oauth_metadata: {
        ...oauthMetadata,
        encrypted_tokens: encryptOAuthTokens(mergedTokens),
        expires_at: expiresAt,
        token_type: mergedTokens.token_type ?? null,
        last_refreshed_at: new Date().toISOString(),
      } satisfies Json,
      status: 'connected',
      error_message: null,
    })
    .eq('id', connection.id)

  return mergedTokens.access_token
}

function getJsonRecord(value: Json) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}
