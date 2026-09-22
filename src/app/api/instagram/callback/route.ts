import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { completeInstagramOAuthConnection } from '@/lib/instagram/connection-service'
import { InstagramOAuthError, verifyInstagramOAuthState } from '@/lib/instagram/oauth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')
  let tenantId: string | null = null

  try {
    if (!state) throw new InstagramOAuthError('instagram_oauth_state_missing')
    const payload = verifyInstagramOAuthState(state)
    tenantId = payload.tenantId

    if (oauthError) {
      return redirectToInstagramSettings(
        request,
        tenantId,
        `instagram_error=${sanitizeOAuthError(oauthError)}`,
      )
    }
    if (!code) {
      return redirectToInstagramSettings(request, tenantId, 'instagram_error=missing_code')
    }

    const access = await requireTenantProductAccess(
      tenantId,
      'manage_instagram',
      'instagram',
    )
    if (access.userId !== payload.userId && access.source !== 'platform') {
      throw new InstagramOAuthError('instagram_oauth_session_mismatch', 403)
    }

    await completeInstagramOAuthConnection(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
      code,
    })

    return redirectToInstagramSettings(request, tenantId, 'instagram_connected=1')
  } catch (error) {
    console.error('[instagram-oauth] callback failed', {
      tenantId,
      code: getSafeErrorCode(error),
      status: error instanceof InstagramOAuthError ? error.status : null,
    })
    if (tenantId) {
      return redirectToInstagramSettings(
        request,
        tenantId,
        `instagram_error=${getSafeRedirectError(error)}`,
      )
    }
    return NextResponse.redirect(new URL('/login?error=instagram_oauth', request.url))
  }
}

function redirectToInstagramSettings(request: NextRequest, tenantId: string, query: string) {
  return NextResponse.redirect(new URL(`/${tenantId}/instagram/settings?${query}`, request.url))
}

function sanitizeOAuthError(error: string) {
  return ['access_denied', 'temporarily_unavailable', 'server_error'].includes(error)
    ? error
    : 'oauth_provider_error'
}

function getSafeErrorCode(error: unknown) {
  return error instanceof InstagramOAuthError
    ? error.code
    : 'instagram_oauth_callback_failed'
}

function getSafeRedirectError(error: unknown) {
  if (
    error instanceof InstagramOAuthError
    && error.code.startsWith('instagram_webhook_subscription_')
  ) {
    return 'webhook_subscription'
  }
  return 'oauth_callback'
}
