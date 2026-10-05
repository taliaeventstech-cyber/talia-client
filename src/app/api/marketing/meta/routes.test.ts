import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireAccess = vi.fn()
const getAuthorizationUrl = vi.fn()
const verifyState = vi.fn()
const exchangeCode = vi.fn()
const exchangeLongLived = vi.fn()
const fetchUser = vi.fn()
const fetchScopes = vi.fn()
const createPendingSession = vi.fn()

vi.mock('@/lib/auth/tenant-access', () => ({
  requireTenantProductAccess: requireAccess,
}))
vi.mock('@/lib/marketing/oauth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/marketing/oauth')>()
  return {
    ...original,
    getMetaMarketingAuthorizationUrl: getAuthorizationUrl,
    verifyMetaMarketingOAuthState: verifyState,
    exchangeMetaMarketingAuthorizationCode: exchangeCode,
    exchangeMetaMarketingLongLivedToken: exchangeLongLived,
    fetchMetaMarketingUser: fetchUser,
    fetchMetaMarketingGrantedScopes: fetchScopes,
  }
})
vi.mock('@/lib/marketing/oauth-session', () => ({
  META_MARKETING_OAUTH_COOKIE: 'talia_meta_marketing_oauth',
  createPendingMetaMarketingOAuthSession: createPendingSession,
  getMetaMarketingOAuthCookieOptions: () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 900,
  }),
}))

const tenantId = '10000000-0000-4000-8000-000000000001'
const userId = '20000000-0000-4000-8000-000000000001'

describe('Meta Marketing OAuth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAccess.mockResolvedValue({ userId, source: 'tenant' })
    getAuthorizationUrl.mockReturnValue(
      new URL('https://www.facebook.com/v26.0/dialog/oauth?state=signed'),
    )
    verifyState.mockReturnValue({ tenantId, userId, provider: 'meta_marketing' })
    exchangeCode.mockResolvedValue({ access_token: 'short-token', expires_in: 3600 })
    exchangeLongLived.mockResolvedValue({
      access_token: 'long-token',
      token_type: 'bearer',
      expires_in: 5_184_000,
    })
    fetchUser.mockResolvedValue({ id: 'meta-user-1', name: 'TALIA Operator' })
    fetchScopes.mockResolvedValue(['ads_read', 'ads_management', 'business_management'])
    createPendingSession.mockReturnValue('encrypted-pending-session')
  })

  it('starts OAuth only after Marketing access is authorized', async () => {
    const { GET } = await import('./connect/route')
    const response = await GET(new NextRequest(
      `https://agora.example.test/api/marketing/meta/connect?tenantId=${tenantId}`,
    ))

    expect(requireAccess).toHaveBeenCalledWith(tenantId, 'manage_marketing', 'marketing')
    expect(getAuthorizationUrl).toHaveBeenCalledWith({ tenantId, userId })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('facebook.com/v26.0/dialog/oauth')
  })

  it('rejects malformed venue identifiers before authorization', async () => {
    const { GET } = await import('./connect/route')
    const response = await GET(new NextRequest(
      'https://agora.example.test/api/marketing/meta/connect?tenantId=not-a-uuid',
    ))

    expect(response.status).toBe(400)
    expect(requireAccess).not.toHaveBeenCalled()
  })

  it('creates an encrypted pending session before asset selection', async () => {
    const { GET } = await import('./callback/route')
    const response = await GET(new NextRequest(
      'https://agora.example.test/api/marketing/meta/callback?code=one-use-code&state=signed',
    ))

    expect(requireAccess).toHaveBeenCalledWith(tenantId, 'manage_marketing', 'marketing')
    expect(exchangeCode).toHaveBeenCalledWith('one-use-code')
    expect(exchangeLongLived).toHaveBeenCalledWith('short-token')
    expect(createPendingSession).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      userId,
      metaUserId: 'meta-user-1',
      accessToken: 'long-token',
      scopes: ['ads_read', 'ads_management', 'business_management'],
    }))
    expect(response.headers.get('location')).toBe(
      `https://agora.example.test/${tenantId}/marketing/connect`,
    )
    expect(response.headers.get('set-cookie')).toContain(
      'talia_meta_marketing_oauth=encrypted-pending-session',
    )
  })

  it('does not exchange a code for a different TALIA user', async () => {
    requireAccess.mockResolvedValue({
      userId: '30000000-0000-4000-8000-000000000001',
      source: 'tenant',
    })
    const { GET } = await import('./callback/route')
    const response = await GET(new NextRequest(
      'https://agora.example.test/api/marketing/meta/callback?code=one-use-code&state=signed',
    ))

    expect(exchangeCode).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      `https://agora.example.test/${tenantId}/marketing?meta_error=oauth_callback`,
    )
  })
})
