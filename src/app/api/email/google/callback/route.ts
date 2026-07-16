import { requireLegacyEmailAgentPermission } from '@/lib/email/legacy-access'
import {
  encryptOAuthTokens,
  exchangeGoogleCodeForTokens,
  fetchGmailProfile,
  GOOGLE_GMAIL_SCOPES,
  verifyGoogleOAuthState,
} from '@/lib/email/google-oauth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')
  let tenantId: string | null = null

  try {
    if (!state) {
      throw new Error('Missing OAuth state')
    }

    const payload = verifyGoogleOAuthState(state)
    tenantId = payload.tenantId

    if (oauthError) {
      return redirectToEmail(request, tenantId, `email_error=${encodeURIComponent(oauthError)}`)
    }

    if (!code) {
      return redirectToEmail(request, tenantId, 'email_error=missing_code')
    }

    const access = await requireLegacyEmailAgentPermission(tenantId)
    if (access.userId !== payload.userId && access.source !== 'platform') {
      throw new Error('OAuth session does not match the initiating user')
    }

    const tokens = await exchangeGoogleCodeForTokens(code)
    const gmailProfile = await fetchGmailProfile(tokens.access_token)
    const encryptedTokens = encryptOAuthTokens(tokens)
    const admin = createAdminClient()
    const scopes = tokens.scope ? tokens.scope.split(' ') : [...GOOGLE_GMAIL_SCOPES]
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const { data: latestConnection } = await admin
      .from('email_connections')
      .select('id')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const connectionPayload = {
      theatre_id: tenantId,
      provider: 'google' as const,
      mailbox_email: gmailProfile.emailAddress.toLowerCase(),
      status: 'connected' as const,
      sync_mode: 'polling' as const,
      draft_mode: 'provider_drafts' as const,
      last_synced_at: null,
      error_message: null,
      oauth_metadata: {
        connected_at: new Date().toISOString(),
        connected_by: access.userId,
        scopes,
        token_type: tokens.token_type ?? 'Bearer',
        expires_at: expiresAt,
        gmail_profile: gmailProfile,
        encrypted_tokens: encryptedTokens,
      },
    }

    const result = latestConnection
      ? await admin
        .from('email_connections')
        .update(connectionPayload)
        .eq('id', latestConnection.id)
      : await admin
        .from('email_connections')
        .insert(connectionPayload)

    if (result.error) {
      throw result.error
    }

    return redirectToEmail(request, tenantId, 'email_connected=1')
  } catch (error) {
    console.error('[email-google-callback]', error)
    if (tenantId) {
      await markConnectionError(tenantId, error)
      return redirectToEmail(request, tenantId, 'email_error=oauth_callback')
    }

    return NextResponse.redirect(new URL('/login?error=email_oauth', request.url))
  }
}

function redirectToEmail(request: NextRequest, tenantId: string, query: string) {
  return NextResponse.redirect(new URL(`/${tenantId}/email?${query}`, request.url))
}

async function markConnectionError(tenantId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown Google OAuth error'
  const admin = createAdminClient()
  const { data: latestConnection } = await admin
    .from('email_connections')
    .select('id')
    .eq('theatre_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestConnection) return

  await admin
    .from('email_connections')
    .update({
      status: 'error',
      error_message: message.slice(0, 500),
    })
    .eq('id', latestConnection.id)
}
