import { afterEach, describe, expect, it, vi } from 'vitest'
import { cancelStripeSubscription, createStripeCustomerPortalSession } from './server'

describe('Stripe customer portal sessions', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('creates a direct subscription cancellation flow', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_talia')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'bps_cancel', url: 'https://billing.stripe.com/cancel' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createStripeCustomerPortalSession({
      customerId: 'cus_talia',
      subscriptionId: 'sub_talia',
      flow: 'cancel',
      returnUrl: 'https://app.talia.events/tenant/upgrade',
    })

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(String(request.body))
    expect(body.get('customer')).toBe('cus_talia')
    expect(body.get('flow_data[type]')).toBe('subscription_cancel')
    expect(body.get('flow_data[subscription_cancel][subscription]')).toBe('sub_talia')
    expect(body.get('flow_data[after_completion][type]')).toBe('redirect')
  })

  it('creates a general management portal without forcing cancellation', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_talia')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'bps_manage', url: 'https://billing.stripe.com/manage' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createStripeCustomerPortalSession({
      customerId: 'cus_talia',
      flow: 'manage',
      returnUrl: 'https://app.talia.events/tenant/upgrade',
    })

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(String(request.body))
    expect(body.get('customer')).toBe('cus_talia')
    expect(body.has('flow_data[type]')).toBe(false)
  })
})

describe('Stripe administrative subscription cancellation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('schedules cancellation at the end of the paid period by default', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_talia')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'sub_talia', status: 'active', cancel_at_period_end: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await cancelStripeSubscription({ subscriptionId: 'sub_talia', mode: 'period_end' })

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/subscriptions/sub_talia')
    expect(request.method).toBe('POST')
    expect(new URLSearchParams(String(request.body)).get('cancel_at_period_end')).toBe('true')
  })

  it('uses Stripe deletion only for an explicit immediate cancellation', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_talia')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'sub_talia', status: 'canceled' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await cancelStripeSubscription({ subscriptionId: 'sub_talia', mode: 'immediate' })

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(request.method).toBe('DELETE')
    expect(request.body).toBeUndefined()
  })
})
