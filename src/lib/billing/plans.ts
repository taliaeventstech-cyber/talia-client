import type { TenantModuleKey } from '@/lib/auth/permissions'

export type BillingPlanKey = 'chatbot_web' | 'chatbot_email' | 'email_agent'
export type BillingAddonKey = 'white_label' | 'plus_2000_messages' | 'onboarding_premium'

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

export const FREE_TRIAL_DAYS = 14

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: 'chatbot_web',
    title: 'Asistente de IA',
    priceMonthly: 19,
    includedLabel: '1.000 missatges / mes',
    description: 'Asistente 24/7 para web.',
    features: [
      'Asistente 24/7 en catalán, castellano e inglés',
      'Dashboard Àgora incluido',
      'Informe mensual de actividad',
      'Supervisión humana continua',
    ],
    moduleKeys: ['chatbot', 'data'],
    includedChatConversations: 1000,
    includedEmailConversations: 0,
    stripePriceEnv: 'STRIPE_CHATBOT_LITE_PRICE_ID',
  },
  {
    key: 'chatbot_email',
    title: 'Asistente de IA + Correo',
    priceMonthly: 39,
    includedLabel: '1.000 missatges / canal',
    description: 'Asistente web y agente de correo.',
    features: [
      'Todo lo incluido en Asistente de IA',
      'Agente de correo para buzón info@',
      'Respuestas automáticas por mail',
      'Informes y supervisión continua',
    ],
    moduleKeys: ['chatbot', 'email', 'data'],
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
    description: 'Elimina el "Powered by GoTalia".',
    billingMode: 'recurring',
    stripePriceEnv: 'STRIPE_WHITELABEL_PRICE_ID',
  },
  {
    key: 'plus_2000_messages',
    title: '+2.000 mensajes',
    priceMonthly: 25,
    description: 'Amplía el límite mensual del chatbot.',
    billingMode: 'recurring',
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

export function getBillingAddon(addonKey: string | null | undefined) {
  return BILLING_ADDONS.find((addon) => addon.key === addonKey)
}

export function getBillingPlanByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined
  return BILLING_PLANS.find((plan) => getStripePriceIdForPlan(plan) === priceId)
}

export function getBillingAddonByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined
  return BILLING_ADDONS.find((addon) => getStripePriceIdForAddon(addon) === priceId)
}

export function getDefaultUpgradePlan() {
  return BILLING_PLANS.find((plan) => plan.highlighted) ?? BILLING_PLANS[0]
}

export function getStripePriceIdForPlan(plan: BillingPlan) {
  return process.env[plan.stripePriceEnv]
}

export function isStripeConfiguredForPlan(plan: BillingPlan) {
  return Boolean(process.env.STRIPE_SECRET_KEY && getStripePriceIdForPlan(plan))
}

export function getStripePriceIdForAddon(addon: BillingAddon) {
  return addon.stripePriceEnv ? process.env[addon.stripePriceEnv] : undefined
}

export function isStripeConfiguredForAddon(addon: BillingAddon) {
  return Boolean(process.env.STRIPE_SECRET_KEY && getStripePriceIdForAddon(addon))
}
