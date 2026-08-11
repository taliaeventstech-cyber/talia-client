import type { TenantModuleKey } from '@/lib/auth/permissions'
import {
  getCommercialCurrency,
  type CommercialCurrency,
  type CommercialMarketCountry,
} from '@/lib/billing/market'

export type BillingPlanKey = 'chatbot_web' | 'chatbot_email' | 'email_agent'
export type BillingAddonKey = 'white_label' | 'plus_2000_messages' | 'onboarding_premium'
export type BillingCadence = 'monthly' | 'yearly'

export type CommercialPrice = {
  amount: number
  currency: CommercialCurrency
  stripePriceEnv: string
}

export type BillingPlan = {
  key: BillingPlanKey
  title: string
  priceMonthly: number
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
  priceMonthly: number
  priceOneTime?: number
  description: string
  billingMode: 'recurring' | 'one_time'
  stripePriceEnv?: string
  includedChatConversations?: number
}

export const FREE_TRIAL_DAYS = 15
export const PUBLIC_BILLING_PLAN_KEYS: readonly BillingPlanKey[] = ['chatbot_web']

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: 'chatbot_web',
    title: 'Agente Web',
    priceMonthly: 19,
    includedLabel: '1.000 missatges / mes',
    description: 'Agente Web disponible 24/7.',
    features: [
      'Agente Web 24/7 en catalán, castellano, inglés y portugués de Brasil',
      'Dashboard Àgora incluido',
      'Informe mensual de actividad',
      'Supervisión humana continua',
    ],
    moduleKeys: ['web', 'data'],
    includedChatConversations: 1000,
    includedEmailConversations: 0,
    stripePriceEnv: 'STRIPE_CHATBOT_LITE_PRICE_ID',
  },
  {
    key: 'chatbot_email',
    title: 'Agente Web + Correo',
    priceMonthly: 39,
    includedLabel: '1.000 missatges / canal',
    description: 'Agente Web y agente de correo.',
    features: [
      'Todo lo incluido en Agente Web',
      'Agente de correo para buzón info@',
      'Respuestas automáticas por mail',
      'Informes y supervisión continua',
    ],
    moduleKeys: ['web', 'email', 'data'],
    includedChatConversations: 1000,
    includedEmailConversations: 1000,
    stripePriceEnv: 'STRIPE_CHATBOT_MAIL_LITE_PRICE_ID',
    highlighted: true,
  },
  {
    key: 'email_agent',
    title: 'Agent de Correu',
    priceMonthly: 25,
    includedLabel: '1.000 missatges / mes',
    description: 'Agente de correo conectado a Gmail u Outlook.',
    features: [
      'Respuestas automáticas por mail',
      'Buzón info@ gestionado por IA',
      'Dashboard Àgora incluido',
      'Informe mensual de actividad',
    ],
    moduleKeys: ['email', 'data'],
    includedChatConversations: 0,
    includedEmailConversations: 1000,
    stripePriceEnv: 'STRIPE_MAIL_LITE_PRICE_ID',
  },
]

export const BILLING_ADDONS: BillingAddon[] = [
  {
    key: 'white_label',
    title: 'Complement Marca Blanca',
    priceMonthly: 49,
    description: 'Elimina el "Powered by Talia".',
    billingMode: 'recurring',
    stripePriceEnv: 'STRIPE_WHITELABEL_PRICE_ID',
  },
  {
    key: 'plus_2000_messages',
    title: '+2.000 mensajes',
    priceMonthly: 0,
    priceOneTime: 25,
    description: 'Añade 2.000 mensajes al periodo de consumo en curso.',
    billingMode: 'one_time',
    stripePriceEnv: 'STRIPE_PLUS_2000_MESSAGES_PRICE_ID',
    includedChatConversations: 2000,
  },
  {
    key: 'onboarding_premium',
    title: 'Onboarding Premium',
    priceMonthly: 0,
    priceOneTime: 199,
    description: 'Acompañamiento premium de activación.',
    billingMode: 'one_time',
    stripePriceEnv: 'STRIPE_ONBOARDING_PREMIUM_PRICE_ID',
  },
]

export function getBillingPlan(planKey: string | null | undefined) {
  return BILLING_PLANS.find((plan) => plan.key === planKey)
}

export function isPublicBillingPlan(planKey: BillingPlanKey) {
  return PUBLIC_BILLING_PLAN_KEYS.includes(planKey)
}

export function getBillingAddon(addonKey: string | null | undefined) {
  return BILLING_ADDONS.find((addon) => addon.key === addonKey)
}

const PLAN_PRICES: Record<BillingPlanKey, Partial<Record<CommercialMarketCountry, Partial<Record<BillingCadence, CommercialPrice>>>>> = {
  chatbot_web: {
    ES: {
      monthly: price(19, 'ES', 'STRIPE_CHATBOT_LITE_PRICE_ID'),
      yearly: price(190, 'ES', 'STRIPE_CHATBOT_LITE_SPAIN_YEARLY_PRICE_ID'),
    },
    MX: {
      monthly: price(399, 'MX', 'STRIPE_CHATBOT_LITE_MEXICO_PRICE_ID'),
      yearly: price(3990, 'MX', 'STRIPE_CHATBOT_LITE_MEXICO_YEARLY_PRICE_ID'),
    },
    BR: {
      monthly: price(99, 'BR', 'STRIPE_CHATBOT_LITE_BRASIL_PRICE_ID'),
      yearly: price(990, 'BR', 'STRIPE_CHATBOT_LITE_BRASIL_YEARLY_PRICE_ID'),
    },
  },
  chatbot_email: {
    ES: { monthly: price(39, 'ES', 'STRIPE_CHATBOT_MAIL_LITE_PRICE_ID') },
  },
  email_agent: {
    ES: { monthly: price(25, 'ES', 'STRIPE_MAIL_LITE_PRICE_ID') },
  },
}

const ADDON_PRICES: Record<BillingAddonKey, Partial<Record<CommercialMarketCountry, Partial<Record<BillingCadence | 'one_time', CommercialPrice>>>>> = {
  white_label: {
    ES: {
      monthly: price(49, 'ES', 'STRIPE_WHITELABEL_PRICE_ID'),
      yearly: price(490, 'ES', 'STRIPE_WHITELABLE_SPAIN_YEARLY_PRICE_ID'),
    },
    MX: {
      monthly: price(999, 'MX', 'STRIPE_WHITELABLE_MEXICO_PRICE_ID'),
      yearly: price(9990, 'MX', 'STRIPE_WHITELABLE_MEXICO_YEARLY_PRICE_ID'),
    },
    BR: {
      monthly: price(299, 'BR', 'STRIPE_WHITELABLE_BRASIL_PRICE_ID'),
      yearly: price(2990, 'BR', 'STRIPE_WHITELABLE_BRASIL_YEARLY_PRICE_ID'),
    },
  },
  plus_2000_messages: {
    ES: { one_time: price(25, 'ES', 'STRIPE_PLUS_2000_MESSAGES_PRICE_ID') },
    MX: { one_time: price(499, 'MX', 'STRIPE_PLUS_2000_MESSAGES_MEXICO_PRICE_ID') },
    BR: { one_time: price(149, 'BR', 'STRIPE_PLUS_2000_MESSAGES_BRASIL_PRICE_ID') },
  },
  onboarding_premium: {
    ES: { one_time: price(199, 'ES', 'STRIPE_ONBOARDING_PREMIUM_PRICE_ID') },
    MX: { one_time: price(3990, 'MX', 'STRIPE_ONBOARDING_PREMIUM_MEXICO_PRICE_ID') },
    BR: { one_time: price(1199, 'BR', 'STRIPE_ONBOARDING_PREMIUM_BRASIL_PRICE_ID') },
  },
}

export function getBillingPlanByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined
  return BILLING_PLANS.find((plan) => getAllPlanPrices(plan.key).some((candidate) => process.env[candidate.stripePriceEnv] === priceId))
}

export function getBillingAddonByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined
  return BILLING_ADDONS.find((addon) => getAllAddonPrices(addon.key).some((candidate) => process.env[candidate.stripePriceEnv] === priceId))
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

export function getBillingAddonPrice(addon: BillingAddon, country: CommercialMarketCountry, cadence: BillingCadence = 'monthly') {
  const interval = addon.billingMode === 'one_time' ? 'one_time' : cadence
  return ADDON_PRICES[addon.key][country]?.[interval]
}

export function getStripePriceIdForAddon(addon: BillingAddon, country: CommercialMarketCountry = 'ES', cadence: BillingCadence = 'monthly') {
  const configuredPrice = getBillingAddonPrice(addon, country, cadence)
  return configuredPrice ? process.env[configuredPrice.stripePriceEnv] : undefined
}

export function isStripeConfiguredForAddon(addon: BillingAddon, country: CommercialMarketCountry = 'ES', cadence: BillingCadence = 'monthly') {
  return Boolean(process.env.STRIPE_SECRET_KEY && getStripePriceIdForAddon(addon, country, cadence))
}

export function getBillingCadenceByPriceId(priceId: string | null | undefined): BillingCadence | undefined {
  if (!priceId) return undefined
  for (const plan of BILLING_PLANS) {
    for (const country of ['ES', 'MX', 'BR'] as const) {
      for (const cadence of ['monthly', 'yearly'] as const) {
        const candidate = getBillingPlanPrice(plan, country, cadence)
        if (candidate && process.env[candidate.stripePriceEnv] === priceId) return cadence
      }
    }
  }
  return undefined
}

function price(amount: number, country: CommercialMarketCountry, stripePriceEnv: string): CommercialPrice {
  return { amount, currency: getCommercialCurrency(country), stripePriceEnv }
}

function getAllPlanPrices(planKey: BillingPlanKey) {
  return Object.values(PLAN_PRICES[planKey]).flatMap((byCadence) => Object.values(byCadence ?? {}))
}

function getAllAddonPrices(addonKey: BillingAddonKey) {
  return Object.values(ADDON_PRICES[addonKey]).flatMap((byCadence) => Object.values(byCadence ?? {}))
}
