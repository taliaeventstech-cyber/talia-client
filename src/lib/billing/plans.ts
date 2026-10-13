import type { TenantModuleKey } from '@/lib/auth/permissions'
import {
  getCommercialCurrency,
  type CommercialCurrency,
  type CommercialMarketCountry,
} from '@/lib/billing/market'

export type BillingPlanKey = 'basic' | 'premium'
export type BillingAddonKey = 'white_label' | 'plus_2000_messages' | 'onboarding_premium'
export type BillingCadence = 'monthly' | 'yearly'

export type CommercialPrice = {
  amount: number | null
  currency: CommercialCurrency
  stripePriceEnv: string
}

export type BillingPlan = {
  key: BillingPlanKey
  title: string
  priceMonthly: number | null
  includedLabel: string
  description: string
  features: string[]
  moduleKeys: TenantModuleKey[]
  includedChatConversations: number
  includedEmailConversations: number
  stripePriceEnv: string
  highlighted?: boolean
}

export type BillingAddon = {
  key: BillingAddonKey
  title: string
  priceMonthly: number | null
  priceOneTime?: number | null
  description: string
  billingMode: 'recurring' | 'one_time'
  stripePriceEnv?: string
  includedChatConversations?: number
}

export const FREE_TRIAL_DAYS = 7
export const PUBLIC_BILLING_PLAN_KEYS: readonly BillingPlanKey[] = ['basic', 'premium']

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: 'basic',
    title: 'Básico',
    priceMonthly: 60,
    includedLabel: '2.000 mensajes al mes',
    description: 'Plan esencial para gestionar las conversaciones del Agente Web.',
    features: [
      'Panel de datos y soporte por correo (48 h)',
      'Tú editas tus respuestas',
      'Estudio de Audiencia Esencial disponible como extra',
      'Sin permanencia — cancela avisando con 30 días',
    ],
    moduleKeys: ['web', 'data'],
    includedChatConversations: 2000,
    includedEmailConversations: 0,
    stripePriceEnv: 'STRIPE_BASIC_PRICE_ID',
  },
  {
    key: 'premium',
    title: 'Premium',
    priceMonthly: 120,
    includedLabel: '10.000 mensajes al mes',
    description: 'Plan completo con acompañamiento y análisis continuo.',
    features: [
      'Estudio de Audiencia Esencial incluido',
      'Ciclo mensual completo: revisión de conversaciones, test de calidad, actualización de respuestas, informe y videollamada',
      'Soporte prioritario 24 h, canal directo',
      'Precio bloqueado 24 meses, incluidos los canales nuevos que lancemos en ese periodo',
      'Estudio Avanzado disponible después, cuando lo queráis',
    ],
    moduleKeys: ['web', 'data'],
    includedChatConversations: 10000,
    includedEmailConversations: 0,
    stripePriceEnv: 'STRIPE_PREMIUM_PRICE_ID',
    highlighted: true,
  },
]

// The former add-ons are no longer part of the public offer. This empty list is
// intentionally retained while the historical Stripe reconciliation code ages out.
export const BILLING_ADDONS: BillingAddon[] = []

export function getBillingPlan(planKey: string | null | undefined) {
  return BILLING_PLANS.find((plan) => plan.key === normalizeBillingPlanKey(planKey))
}

export function isPublicBillingPlan(planKey: BillingPlanKey) {
  return PUBLIC_BILLING_PLAN_KEYS.includes(planKey)
}

export function getBillingAddon(_addonKey: string | null | undefined): BillingAddon | undefined {
  return undefined
}

const PLAN_PRICES: Record<BillingPlanKey, Partial<Record<CommercialMarketCountry, Partial<Record<BillingCadence, CommercialPrice>>>>> = {
  basic: {
    ES: { monthly: price(60, 'ES', 'STRIPE_BASIC_PRICE_ID') },
    MX: { monthly: price(null, 'MX', 'STRIPE_BASIC_MEXICO_PRICE_ID') },
    BR: { monthly: price(null, 'BR', 'STRIPE_BASIC_BRAZIL_PRICE_ID') },
  },
  premium: {
    ES: { monthly: price(120, 'ES', 'STRIPE_PREMIUM_PRICE_ID') },
    MX: { monthly: price(null, 'MX', 'STRIPE_PREMIUM_MEXICO_PRICE_ID') },
    BR: { monthly: price(null, 'BR', 'STRIPE_PREMIUM_BRAZIL_PRICE_ID') },
  },
}

export function getBillingPlanByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined
  return BILLING_PLANS.find((plan) => getAllPlanPrices(plan.key).some((candidate) => process.env[candidate.stripePriceEnv] === priceId))
}

export function getBillingAddonByPriceId(_priceId: string | null | undefined): BillingAddon | undefined {
  return undefined
}

export function getDefaultUpgradePlan() {
  return BILLING_PLANS.find((plan) => plan.highlighted) ?? BILLING_PLANS[0]
}

export function getBillingPlanPrice(plan: BillingPlan, country: CommercialMarketCountry, cadence: BillingCadence) {
  return PLAN_PRICES[plan.key][country]?.[cadence]
}

export function getStripePriceIdForPlan(plan: BillingPlan, country: CommercialMarketCountry = 'ES', cadence: BillingCadence = 'monthly') {
  const configuredPrice = getBillingPlanPrice(plan, country, cadence)
  return configuredPrice ? process.env[configuredPrice.stripePriceEnv] : undefined
}

export function isStripeConfiguredForPlan(plan: BillingPlan, country: CommercialMarketCountry = 'ES', cadence: BillingCadence = 'monthly') {
  return Boolean(process.env.STRIPE_SECRET_KEY && getStripePriceIdForPlan(plan, country, cadence))
}

export function getBillingAddonPrice(_addon: BillingAddon, _country: CommercialMarketCountry, _cadence: BillingCadence = 'monthly'): CommercialPrice | undefined {
  return undefined
}

export function getStripePriceIdForAddon(_addon: BillingAddon, _country: CommercialMarketCountry = 'ES', _cadence: BillingCadence = 'monthly'): string | undefined {
  return undefined
}

export function isStripeConfiguredForAddon(_addon: BillingAddon, _country: CommercialMarketCountry = 'ES', _cadence: BillingCadence = 'monthly') {
  return false
}

export function getBillingCadenceByPriceId(priceId: string | null | undefined): BillingCadence | undefined {
  if (!priceId) return undefined
  for (const plan of BILLING_PLANS) {
    for (const country of ['ES', 'MX', 'BR'] as const) {
      const candidate = getBillingPlanPrice(plan, country, 'monthly')
      if (candidate && process.env[candidate.stripePriceEnv] === priceId) return 'monthly'
    }
  }
  return undefined
}

function normalizeBillingPlanKey(planKey: string | null | undefined): BillingPlanKey | undefined {
  if (planKey === 'basic' || planKey === 'chatbot_web' || planKey === 'email_agent') return 'basic'
  if (planKey === 'premium' || planKey === 'chatbot_email') return 'premium'
  return undefined
}

function price(amount: number | null, country: CommercialMarketCountry, stripePriceEnv: string): CommercialPrice {
  return { amount, currency: getCommercialCurrency(country), stripePriceEnv }
}

function getAllPlanPrices(planKey: BillingPlanKey) {
  return Object.values(PLAN_PRICES[planKey]).flatMap((byCadence) => Object.values(byCadence ?? {}))
}
