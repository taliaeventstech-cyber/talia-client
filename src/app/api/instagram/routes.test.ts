import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireAccess = vi.fn()
const getAuthorizationUrl = vi.fn()
const verifyState = vi.fn()
const completeConnection = vi.fn()

vi.mock('@/lib/auth/tenant-access', () => ({
  requireTenantProductAccess: requireAccess,
}))
vi.mock('@/lib/instagram/oauth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/instagram/oauth')>()
  return {
    ...original,
    getInstagramAuthorizationUrl: getAuthorizationUrl,
    verifyInstagramOAuthState: verifyState,
  }
})
vi.mock('@/lib/instagram/connection-service', () => ({
  completeInstagramOAuthConnection: completeConnection,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: vi.fn() }),
}))

const tenantId = '10000000-0000-4000-8000-000000000001'
const userId = '20000000-0000-4000-8000-000000000001'

describe('Instagram OAuth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAccess.mockResolvedValue({ userId, source: 'tenant' })
    getAuthorizationUrl.mockReturnValue(new URL('https://www.instagram.com/oauth/authorize?state=signed'))
    verifyState.mockReturnValue({ tenantId, userId, provider: 'instagram' })
    completeConnection.mockResolvedValue({ connectionId: 'connection-id' })
  })

  it('starts OAuth only after Instagram permission and module access', async () => {
    const { GET } = await import('./connect/route')
    const response = await GET(new NextRequest(
      `https://agora.example.test/api/instagram/connect?tenantId=${tenantId}`,
    ))

    expect(requireAccess).toHaveBeenCalledWith(tenantId, 'manage_instagram', 'instagram')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('instagram.com/oauth/authorize')
  })

  it('rejects malformed venue identifiers before authorization', async () => {
    const { GET } = await import('./connect/route')
    const response = await GET(new NextRequest(
      'https://agora.example.test/api/instagram/connect?tenantId=not-a-uuid',
    ))

    expect(response.status).toBe(400)
    expect(requireAccess).not.toHaveBeenCalled()
  })

  it('returns to Instagram settings when OAuth configuration is incomplete', async () => {
    getAuthorizationUrl.mockImplementation(() => {
      throw new Error('instagram_oauth_configuration_missing')
    })
    const { GET } = await import('./connect/route')
    const response = await GET(new NextRequest(
      `https://agora.example.test/api/instagram/connect?tenantId=${tenantId}`,
    ))

    expect(response.headers.get('location')).toBe(
      `https://agora.example.test/${tenantId}/instagram/settings?instagram_error=oauth_config`,
    )
  })

  it('completes OAuth only for the same initiating TALIA user', async () => {
    const { GET } = await import('./callback/route')
    const response = await GET(new NextRequest(
      `https://agora.example.test/api/instagram/callback?code=one-use-code&state=signed`,
    ))

    expect(requireAccess).toHaveBeenCalledWith(tenantId, 'manage_instagram', 'instagram')
    expect(completeConnection).toHaveBeenCalledWith(expect.anything(), {
      tenantId,
      actorUserId: userId,
      code: 'one-use-code',
    })
    expect(response.headers.get('location')).toBe(
      `https://agora.example.test/${tenantId}/instagram/settings?instagram_connected=1`,
    )
  })

  it('does not exchange a code after an OAuth user mismatch', async () => {
    requireAccess.mockResolvedValue({
      userId: '30000000-0000-4000-8000-000000000001',
      source: 'tenant',
    })
    const { GET } = await import('./callback/route')
    const response = await GET(new NextRequest(
      'https://agora.example.test/api/instagram/callback?code=one-use-code&state=signed',
    ))

    expect(completeConnection).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toContain('instagram_error=oauth_callback')
  })
})
