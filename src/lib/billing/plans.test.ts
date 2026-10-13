import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBillingCadenceByPriceId,
  getBillingPlan,
  getBillingPlanByPriceId,
  getBillingPlanPrice,
  getStripePriceIdForPlan,
  isPublicBillingPlan,
} from './plans'

afterEach(() => vi.unstubAllEnvs())

describe('public billing plans', () => {
  it('exposes Basic and Premium', () => {
    expect(isPublicBillingPlan('basic')).toBe(true)
    expect(isPublicBillingPlan('premium')).toBe(true)
  })

  it('publishes the Spanish monthly prices', () => {
    expect(getBillingPlanPrice(getBillingPlan('basic')!, 'ES', 'monthly')).toMatchObject({ amount: 60, currency: 'EUR' })
    expect(getBillingPlanPrice(getBillingPlan('premium')!, 'ES', 'monthly')).toMatchObject({ amount: 120, currency: 'EUR' })
  })

  it('maps retired plan keys so existing subscriptions retain their allowance', () => {
    expect(getBillingPlan('chatbot_web')?.key).toBe('basic')
    expect(getBillingPlan('chatbot_email')?.key).toBe('premium')
  })
})

describe('localized Stripe prices', () => {
  it('uses the configured Basic and Premium price IDs in each launch market', () => {
    vi.stubEnv('STRIPE_BASIC_MEXICO_PRICE_ID', 'price_basic_mx')
    vi.stubEnv('STRIPE_PREMIUM_BRAZIL_PRICE_ID', 'price_premium_br')
    const basic = getBillingPlan('basic')!
    const premium = getBillingPlan('premium')!

    expect(getStripePriceIdForPlan(basic, 'MX', 'monthly')).toBe('price_basic_mx')
    expect(getStripePriceIdForPlan(premium, 'BR', 'monthly')).toBe('price_premium_br')
    expect(getBillingPlanByPriceId('price_premium_br')?.key).toBe('premium')
    expect(getBillingCadenceByPriceId('price_premium_br')).toBe('monthly')
  })
})
