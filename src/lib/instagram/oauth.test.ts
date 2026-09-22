import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createInstagramOAuthState,
  exchangeInstagramAuthorizationCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramProfessionalProfile,
  getInstagramAuthorizationUrl,
  INSTAGRAM_OAUTH_SCOPES,
  subscribeInstagramMessagingWebhooks,
  verifyInstagramOAuthState,
} from './oauth'

const STATE_SECRET = 'instagram-state-secret-at-least-32-characters'

describe('Instagram OAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('requests only the profile and messaging scopes required by the pilot', () => {
    expect(INSTAGRAM_OAUTH_SCOPES).toEqual([
      'instagram_business_basic',
      'instagram_business_manage_messages',
    ])
  })

  it('builds a direct Instagram Login authorization URL bound to venue and user', () => {
    configureOAuth()
    const url = getInstagramAuthorizationUrl({ tenantId: 'venue-1', userId: 'user-1' })

    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('instagram-app-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://agora.example.test/api/instagram/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe(INSTAGRAM_OAUTH_SCOPES.join(','))
    expect(verifyInstagramOAuthState(url.searchParams.get('state')!)).toMatchObject({
      provider: 'instagram',
      tenantId: 'venue-1',
      userId: 'user-1',
    })
  })

  it('rejects tampered and expired OAuth state', () => {
    vi.stubEnv('INSTAGRAM_OAUTH_STATE_SECRET', STATE_SECRET)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T10:00:00.000Z'))
    const state = createInstagramOAuthState({ tenantId: 'venue-1', userId: 'user-1' })

    expect(() => verifyInstagramOAuthState(`${state.slice(0, -1)}x`))
      .toThrow('instagram_oauth_state_invalid')

    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(() => verifyInstagramOAuthState(state)).toThrow('instagram_oauth_state_expired')
  })

  it('does not reuse WhatsApp credentials implicitly', () => {
    vi.stubEnv('NEXT_PUBLIC_META_APP_ID', 'whatsapp-app-id')
    vi.stubEnv('META_APP_SECRET', 'whatsapp-secret')
    vi.stubEnv('META_INSTAGRAM_APP_ID', '')
    vi.stubEnv('META_INSTAGRAM_APP_SECRET', '')
    vi.stubEnv('INSTAGRAM_OAUTH_STATE_SECRET', STATE_SECRET)

    expect(() => getInstagramAuthorizationUrl({ tenantId: 'venue-1', userId: 'user-1' }))
      .toThrow('instagram_oauth_configuration_missing')
  })

  it('exchanges the callback code without exposing provider error bodies', async () => {
    configureOAuth()
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'short-lived-token',
      user_id: 29028644286753871,
    }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({
      error_message: 'access_token=secret customer@example.com',
    }), { status: 401 }))

    await expect(exchangeInstagramAuthorizationCode('authorization-code', { fetcher }))
      .resolves.toEqual({ access_token: 'short-lived-token' })

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('client_secret')).toBe('instagram-app-secret')

    await expect(exchangeInstagramAuthorizationCode('authorization-code', { fetcher }))
      .rejects.toThrow('instagram_code_exchange_http_401')
    await expect(exchangeInstagramAuthorizationCode('authorization-code', {
      fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error_message: 'customer@example.com',
      }), { status: 401 })),
    })).rejects.not.toThrow('customer@example.com')
  })

  it('exchanges a short-lived token for a long-lived token server-side', async () => {
    configureOAuth()
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'long-lived-token',
      token_type: 'bearer',
      expires_in: 5_184_000,
    }), { status: 200 }))

    await expect(exchangeInstagramLongLivedToken('short-lived-token', { fetcher }))
      .resolves.toMatchObject({ access_token: 'long-lived-token', expires_in: 5_184_000 })

    const [requestUrl, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    expect(requestUrl.origin + requestUrl.pathname).toBe('https://graph.instagram.com/access_token')
    expect(requestUrl.searchParams.get('grant_type')).toBe('ig_exchange_token')
    expect(requestUrl.searchParams.get('access_token')).toBe('short-lived-token')
    expect(init.method).toBe('GET')
  })

  it('validates the authorized account as Professional without putting its token in the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: '17841480248188457',
      username: 'venue_account',
      account_type: 'MEDIA_CREATOR',
    }), { status: 200 }))

    await expect(fetchInstagramProfessionalProfile('long-lived-token', { fetcher }))
      .resolves.toEqual({
        id: '17841480248188457',
        username: 'venue_account',
        accountType: 'creator',
      })

    const [requestUrl, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    expect(requestUrl.toString()).not.toContain('long-lived-token')
    expect(requestUrl.searchParams.get('fields')).toBe('id,username,account_type')
    expect(init.headers).toEqual({ Authorization: 'Bearer long-lived-token' })
  })

  it('rejects a non-professional account', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: '17841480248188457',
      username: 'personal_account',
      account_type: 'PERSONAL',
    }), { status: 200 }))

    await expect(fetchInstagramProfessionalProfile('token', { fetcher }))
      .rejects.toThrow('instagram_professional_account_required')
  })

  it('subscribes each authorized account only to Instagram messages', async () => {
    vi.stubEnv('META_INSTAGRAM_GRAPH_API_VERSION', 'v26.0')
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true }))

    await expect(subscribeInstagramMessagingWebhooks(
      'long-lived-token',
      { fetcher },
    )).resolves.toBeUndefined()

    const [requestUrl, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    expect(requestUrl.toString()).toBe(
      'https://graph.instagram.com/v26.0/me/subscribed_apps',
    )
    expect(requestUrl.toString()).not.toContain('long-lived-token')
    expect(init.method).toBe('POST')
    expect((init.body as URLSearchParams).get('subscribed_fields')).toBe('messages')
    expect((init.body as URLSearchParams).get('access_token')).toBe('long-lived-token')
  })
})

function configureOAuth() {
  vi.stubEnv('META_INSTAGRAM_APP_ID', 'instagram-app-id')
  vi.stubEnv('META_INSTAGRAM_APP_SECRET', 'instagram-app-secret')
  vi.stubEnv('INSTAGRAM_OAUTH_STATE_SECRET', STATE_SECRET)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://agora.example.test/')
}
