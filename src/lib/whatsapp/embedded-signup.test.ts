import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  exchangeMetaEmbeddedSignupCode,
  getMetaWhatsappPhone,
  registerMetaWhatsappPhone,
  subscribeMetaWhatsappApp,
  unsubscribeMetaWhatsappApp,
} from './embedded-signup'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Meta WhatsApp Embedded Signup client', () => {
  it('exchanges the short-lived code only through the server app credentials', async () => {
    vi.stubEnv('NEXT_PUBLIC_META_APP_ID', 'app-123')
    vi.stubEnv('META_APP_SECRET', 'app-secret')
    vi.stubEnv('META_WHATSAPP_GRAPH_API_VERSION', 'v26.0')
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      access_token: 'business-token',
      token_type: 'bearer',
      expires_in: 5_184_000,
    }))

    const result = await exchangeMetaEmbeddedSignupCode('one-use-code', { fetcher })

    const url = new URL(String(fetcher.mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe('https://graph.facebook.com/v26.0/oauth/access_token')
    expect(url.searchParams.get('client_id')).toBe('app-123')
    expect(url.searchParams.get('client_secret')).toBe('app-secret')
    expect(url.searchParams.get('code')).toBe('one-use-code')
    expect(result.access_token).toBe('business-token')
  })

  it('validates that the selected phone belongs to the selected WABA', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      data: [{ id: 'phone-123', display_phone_number: '+34 600 000 000', verified_name: 'TALÍA' }],
    }))

    await expect(getMetaWhatsappPhone({
      wabaId: 'waba-123',
      phoneNumberId: 'other-phone',
      accessToken: 'business-token',
    }, { fetcher })).rejects.toThrow('meta_phone_not_in_selected_waba')
  })

  it('subscribes the app and registers the phone with a two-step PIN', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ success: true }))

    await subscribeMetaWhatsappApp({ wabaId: 'waba-123', accessToken: 'business-token' }, { fetcher })
    await registerMetaWhatsappPhone({
      phoneNumberId: 'phone-123',
      accessToken: 'business-token',
      twoStepPin: '472901',
    }, { fetcher })

    expect(String(fetcher.mock.calls[0][0])).toContain('/waba-123/subscribed_apps')
    expect(String(fetcher.mock.calls[1][0])).toContain('/phone-123/register')
    expect(JSON.parse(fetcher.mock.calls[1][1].body as string)).toEqual({
      messaging_product: 'whatsapp',
      pin: '472901',
    })
  })

  it('unsubscribes the app from the selected WABA', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true }))

    await unsubscribeMetaWhatsappApp({
      wabaId: 'waba-123',
      accessToken: 'business-token',
    }, { fetcher })

    expect(String(fetcher.mock.calls[0][0])).toContain('/waba-123/subscribed_apps')
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      headers: { Authorization: 'Bearer business-token' },
    })
  })
})
