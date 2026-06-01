import { getBillingAddonByPriceId, getBillingPlanByPriceId, type BillingPlanKey } from '@/lib/billing/plans'
import crypto from 'crypto'

const STRIPE_API_BASE = 'https://api.stripe.com/v1'
const STRIPE_API_VERSION = '2026-02-25.clover'

type StripeRequestOptions = {
  method?: 'GET' | 'POST'
  params?: Record<string, unknown>
}

export type StripeCheckoutSession = {
  id: string
  url: string | null
  customer: string | null
  subscription: string | null
  payment_status?: string
  metadata?: Record<string, string>
}

export type StripeSubscription = {
  id: string
  status: string
  customer: string | null
  current_period_start?: number
  current_period_end?: number
  metadata?: Record<string, string>
  items?: {
    data?: Array<{
      id?: string
      price?: {
        id?: string
      }
    }>
  }
}

export type StripeInvoice = {
  id: string
  subscription?: string | null
}

export type StripeWebhookEvent = {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET
}

export async function createStripeCheckoutSession(input: {
  tenantId: string
  accountId: string
  planKey: BillingPlanKey
  priceId: string
  addonKeys?: string[]
  addonPriceIds?: string[]
  customerId?: string
  customerEmail?: string | null
  successUrl: string
  cancelUrl: string
}) {
  const addonPriceIds = input.addonPriceIds ?? []
  const params: Record<string, unknown> = {
    mode: 'subscription',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.tenantId,
    'line_items[0][price]': input.priceId,
    'line_items[0][quantity]': 1,
    'metadata[tenant_id]': input.tenantId,
    'metadata[account_id]': input.accountId,
    'metadata[plan_key]': input.planKey,
    'metadata[addon_keys]': input.addonKeys?.join(',') ?? '',
    'subscription_data[metadata][tenant_id]': input.tenantId,
    'subscription_data[metadata][account_id]': input.accountId,
    'subscription_data[metadata][plan_key]': input.planKey,
    allow_promotion_codes: true,
  }

  addonPriceIds.forEach((priceId, index) => {
    const lineItemIndex = index + 1
    params[`line_items[${lineItemIndex}][price]`] = priceId
    params[`line_items[${lineItemIndex}][quantity]`] = 1
  })

  if (input.customerId) {
    params.customer = input.customerId
  } else if (input.customerEmail) {
    params.customer_email = input.customerEmail
  }

  return stripeRequest<StripeCheckoutSession>('/checkout/sessions', {
    method: 'POST',
    params,
  })
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<StripeSubscription>(`/subscriptions/${subscriptionId}`)
}

export async function updateStripeSubscription(input: {
  subscriptionId: string
  planKey: BillingPlanKey
  planPriceId: string
  addonPriceIds: string[]
  currentSubscription: StripeSubscription
}) {
  const params: Record<string, unknown> = {
    proration_behavior: 'always_invoice',
    'metadata[plan_key]': input.planKey,
  }
  const desiredAddonPrices = new Set(input.addonPriceIds)
  const items = input.currentSubscription.items?.data ?? []
  const currentBaseItem = items.find((item) => getBillingPlanByPriceId(item.price?.id)) ?? items[0]
  let itemIndex = 0

  if (currentBaseItem?.id) {
    params[`items[${itemIndex}][id]`] = currentBaseItem.id
    params[`items[${itemIndex}][price]`] = input.planPriceId
    itemIndex += 1
  } else {
    params[`items[${itemIndex}][price]`] = input.planPriceId
    itemIndex += 1
  }

  const currentAddonItems = items.filter((item) => item.id && item.price?.id && desiredAddonPrices.has(item.price.id))
  const currentAddonPriceIds = new Set(currentAddonItems.map((item) => item.price?.id).filter((priceId): priceId is string => Boolean(priceId)))
  const removedItems = items.filter((item) => item.id && getBillingAddonByPriceId(item.price?.id) && !desiredAddonPrices.has(item.price?.id ?? ''))

  for (const item of currentAddonItems) {
    if (!item.id || !item.price?.id) continue
    params[`items[${itemIndex}][id]`] = item.id
    params[`items[${itemIndex}][price]`] = item.price.id
    itemIndex += 1
  }

  for (const priceId of input.addonPriceIds) {
    if (currentAddonPriceIds.has(priceId)) continue
    params[`items[${itemIndex}][price]`] = priceId
    params[`items[${itemIndex}][quantity]`] = 1
    itemIndex += 1
  }

  for (const item of removedItems) {
    if (!item.id) continue
    params[`items[${itemIndex}][id]`] = item.id
    params[`items[${itemIndex}][deleted]`] = true
    itemIndex += 1
  }

  return stripeRequest<StripeSubscription>(`/subscriptions/${input.subscriptionId}`, {
    method: 'POST',
    params,
  })
}

export function verifyStripeWebhookPayload(payload: string, signature: string, secret: string) {
  const timestamp = getStripeSignaturePart(signature, 't')
  const expectedSignature = getStripeSignaturePart(signature, 'v1')
  if (!timestamp || !expectedSignature) {
    throw new Error('Invalid Stripe signature header')
  }

  const signedPayload = `${timestamp}.${payload}`
  const digest = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  const expected = Buffer.from(expectedSignature, 'hex')
  const actual = Buffer.from(digest, 'hex')
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('Invalid Stripe webhook signature')
  }

  return JSON.parse(payload) as StripeWebhookEvent
}

function getStripeSignaturePart(signature: string, key: string) {
  return signature
    .split(',')
    .map((part) => part.split('='))
    .find(([partKey]) => partKey === key)?.[1]
}

async function stripeRequest<T>(path: string, options: StripeRequestOptions = {}) {
  const method = options.method ?? 'GET'
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? encodeStripeParams(options.params ?? {}) : undefined,
    cache: 'no-store',
  })

  const payload = await response.json()
  if (!response.ok) {
    const message = typeof payload?.error?.message === 'string'
      ? payload.error.message
      : `Stripe request failed with ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

function encodeStripeParams(params: Record<string, unknown>) {
  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    form.append(key, String(value))
  }
  return form.toString()
}

function requiredEnv(key: string) {
  const value = process.env[key]
  if (!value) throw new Error(`Missing ${key}`)
  return value
}
