import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBillingAddon,
  getBillingAddonPrice,
  getBillingCadenceByPriceId,
  getBillingPlan,
  getBillingPlanByPriceId,
  getStripePriceIdForAddon,
  getStripePriceIdForPlan,
  isPublicBillingPlan,
} from './plans'

afterEach(() => vi.unstubAllEnvs())

describe('public billing plans', () => {
  it('only exposes the Web Agent during the launch phase', () => {
    expect(isPublicBillingPlan('chatbot_web')).toBe(true)
    expect(isPublicBillingPlan('chatbot_email')).toBe(false)
    expect(isPublicBillingPlan('email_agent')).toBe(false)
  })

  it('does not advertise automatic sending for supervised email plans', () => {
    for (const key of ['chatbot_email', 'email_agent'] as const) {
      const plan = getBillingPlan(key)!
      expect(plan.features.join(' ').toLowerCase()).not.toContain('automátic')
      expect(plan.features.join(' ').toLowerCase()).toContain('revisión humana')
    }
  })
})

describe('localized Stripe prices', () => {
  it('uses the exact production environment names for Mexico and Brazil', () => {
    vi.stubEnv('STRIPE_CHATBOT_LITE_MEXICO_PRICE_ID', 'price_mx_month')
    vi.stubEnv('STRIPE_CHATBOT_LITE_BRASIL_YEARLY_PRICE_ID', 'price_br_year')
    vi.stubEnv('STRIPE_WHITELABLE_BRASIL_PRICE_ID', 'price_white_br_month')
    const plan = getBillingPlan('chatbot_web')!
    const whiteLabel = getBillingAddon('white_label')!

    expect(getStripePriceIdForPlan(plan, 'MX', 'monthly')).toBe('price_mx_month')
    expect(getStripePriceIdForPlan(plan, 'BR', 'yearly')).toBe('price_br_year')
    expect(getStripePriceIdForAddon(whiteLabel, 'BR', 'monthly')).toBe('price_white_br_month')
    expect(getBillingPlanByPriceId('price_br_year')?.key).toBe('chatbot_web')
    expect(getBillingCadenceByPriceId('price_br_year')).toBe('yearly')
  })

  it('models message packs as a one-time top-up in each launch market', () => {
    const addon = getBillingAddon('plus_2000_messages')!
    expect(addon.billingMode).toBe('one_time')
    expect(getBillingAddonPrice(addon, 'ES')?.amount).toBe(25)
    expect(getBillingAddonPrice(addon, 'MX')?.amount).toBe(499)
    expect(getBillingAddonPrice(addon, 'BR')?.amount).toBe(149)
  })
})
