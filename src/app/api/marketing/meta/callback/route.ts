import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import {
  exchangeMetaMarketingAuthorizationCode,
  exchangeMetaMarketingLongLivedToken,
  fetchMetaMarketingGrantedScopes,
  fetchMetaMarketingUser,
  MetaMarketingOAuthError,
  verifyMetaMarketingOAuthState,
} from '@/lib/marketing/oauth'
import {
  createPendingMetaMarketingOAuthSession,
  getMetaMarketingOAuthCookieOptions,
  META_MARKETING_OAUTH_COOKIE,
} from '@/lib/marketing/oauth-session'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')
  let tenantId: string | null = null

  try {
    if (!state) throw new MetaMarketingOAuthError('meta_marketing_oauth_state_missing')
    const payload = verifyMetaMarketingOAuthState(state)
    tenantId = payload.tenantId

    if (oauthError) {
      return redirectToMarketing(
        request,
        tenantId,
        `meta_error=${sanitizeOAuthError(oauthError)}`,
      )
    }
    if (!code) return redirectToMarketing(request, tenantId, 'meta_error=missing_code')

    const access = await requireTenantProductAccess(
      tenantId,
      'manage_marketing',
      'marketing',
    )
    if (access.userId !== payload.userId) {
      throw new MetaMarketingOAuthError('meta_marketing_oauth_session_mismatch', 403)
    }

    const shortLived = await exchangeMetaMarketingAuthorizationCode(code)
    const longLived = await exchangeMetaMarketingLongLivedToken(shortLived.access_token)
    if (!longLived.expires_in) {
      throw new MetaMarketingOAuthError('meta_marketing_token_expiry_missing')
    }
    const [metaUser, scopes] = await Promise.all([
      fetchMetaMarketingUser(longLived.access_token),
      fetchMetaMarketingGrantedScopes(longLived.access_token),
    ])
    const tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString()
    const pendingSession = createPendingMetaMarketingOAuthSession({
      tenantId,
      userId: access.userId,
      metaUserId: metaUser.id,
      accessToken: longLived.access_token,
      tokenType: longLived.token_type ?? 'bearer',
      tokenExpiresAt,
      scopes,
    })

    const response = NextResponse.redirect(new URL(`/${tenantId}/marketing/connect`, request.url))
    response.cookies.set(
      META_MARKETING_OAUTH_COOKIE,
      pendingSession,
      getMetaMarketingOAuthCookieOptions(),
    )
    return response
  } catch (error) {
    console.error('[meta-marketing-oauth] callback failed', {
      tenantId,
      code: getSafeErrorCode(error),
      status: error instanceof MetaMarketingOAuthError ? error.status : null,
    })
    if (tenantId) {
      return redirectToMarketing(request, tenantId, 'meta_error=oauth_callback')
    }
    const response = NextResponse.redirect(
      new URL('/login?error=meta_marketing_oauth', request.url),
    )
    response.cookies.delete(META_MARKETING_OAUTH_COOKIE)
    return response
  }
}

function redirectToMarketing(request: NextRequest, tenantId: string, query: string) {
  const response = NextResponse.redirect(
    new URL(`/${tenantId}/marketing?${query}`, request.url),
  )
  response.cookies.delete(META_MARKETING_OAUTH_COOKIE)
  return response
}

function sanitizeOAuthError(error: string) {
  return ['access_denied', 'temporarily_unavailable', 'server_error'].includes(error)
    ? error
    : 'oauth_provider_error'
}

function getSafeErrorCode(error: unknown) {
  return error instanceof MetaMarketingOAuthError
    ? error.code
    : error instanceof Error && /^meta_marketing_[a-z0-9_]+$/.test(error.message)
      ? error.message
      : 'meta_marketing_oauth_callback_failed'
}
