import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMetaMarketingOAuthState,
  fetchMetaMarketingBusinesses,
  fetchMetaMarketingGrantedScopes,
  getMetaMarketingAuthorizationUrl,
  verifyMetaMarketingOAuthState,
} from './oauth'

const tenantId = '657c9c3e-bf4a-45ce-868d-45a2f48db2fb'
const userId = '0d423c31-f1cb-49a4-9b23-6876c1f06e19'

describe('Meta Marketing OAuth', () => {
  beforeEach(() => {
    vi.stubEnv('META_MARKETING_APP_ID', 'meta-app-id')
    vi.stubEnv('META_MARKETING_APP_SECRET', 'meta-app-secret')
    vi.stubEnv('META_MARKETING_OAUTH_STATE_SECRET', 'state-secret-that-is-at-least-32-characters')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.talia.test')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('builds a signed authorization URL with the required scopes', () => {
    const url = getMetaMarketingAuthorizationUrl({ tenantId, userId })

    expect(url.origin).toBe('https://www.facebook.com')
    expect(url.pathname).toBe('/v26.0/dialog/oauth')
    expect(url.searchParams.get('client_id')).toBe('meta-app-id')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.talia.test/api/marketing/meta/callback',
    )
    expect(url.searchParams.get('scope')?.split(',')).toEqual([
      'ads_read',
      'ads_management',
      'business_management',
    ])
    expect(verifyMetaMarketingOAuthState(url.searchParams.get('state')!)).toMatchObject({
      tenantId,
      userId,
      provider: 'meta_marketing',
    })
  })

  it('rejects tampered and expired state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'))
    const state = createMetaMarketingOAuthState({ tenantId, userId })
    const [payload, signature] = state.split('.')

    expect(() => verifyMetaMarketingOAuthState(`${payload}x.${signature}`)).toThrow(
      'meta_marketing_oauth_state_invalid',
    )

    vi.advanceTimersByTime(30 * 60 * 1000 + 1)
    expect(() => verifyMetaMarketingOAuthState(state)).toThrow(
      'meta_marketing_oauth_state_expired',
    )
  })

  it('requires every permission requested by the MVP', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      data: [
        { permission: 'ads_read', status: 'granted' },
        { permission: 'ads_management', status: 'declined' },
        { permission: 'business_management', status: 'granted' },
      ],
    }))

    await expect(fetchMetaMarketingGrantedScopes('access-token', {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('meta_marketing_required_scopes_missing')
  })

  it('loads owned and client ad accounts and removes duplicates', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      if (url.pathname.endsWith('/me/businesses')) {
        return jsonResponse({ data: [{ id: 'business-1', name: 'TALIA Business' }] })
      }
      if (url.pathname.endsWith('/owned_ad_accounts')) {
        return jsonResponse({
          data: [{ id: 'act_1', name: 'Owned Ads', currency: 'EUR', account_status: 1 }],
        })
      }
      if (url.pathname.endsWith('/client_ad_accounts')) {
        return jsonResponse({
          data: [
            { id: 'act_1', name: 'Owned Ads', currency: 'EUR', account_status: 1 },
            { id: 'act_2', name: 'Client Ads', currency: 'USD', account_status: 1 },
          ],
        })
      }
      return jsonResponse({}, 404)
    })

    await expect(fetchMetaMarketingBusinesses('access-token', {
      fetcher: fetcher as typeof fetch,
    })).resolves.toEqual([{
      id: 'business-1',
      name: 'TALIA Business',
      adAccounts: [
        { id: 'act_1', name: 'Owned Ads', currency: 'EUR', account_status: 1 },
        { id: 'act_2', name: 'Client Ads', currency: 'USD', account_status: 1 },
      ],
    }])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
