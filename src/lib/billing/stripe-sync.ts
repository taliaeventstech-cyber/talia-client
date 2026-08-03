import type { createAdminClient } from '@/lib/supabase/admin'
import {
  getBillingAddon,
  getBillingAddonByPriceId,
  getBillingPlan,
  getBillingPlanByPriceId,
  getBillingCadenceByPriceId,
  getDefaultUpgradePlan,
  type BillingCadence,
  type BillingAddon,
  type BillingPlan,
} from '@/lib/billing/plans'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import type { Json } from '@/types/database.types'
import type { StripeCheckoutSession, StripeSubscription } from '@/lib/stripe/server'

type AdminClient = ReturnType<typeof createAdminClient>

type BillingActivationInput = {
  tenantId: string
  accountId: string
  customerId?: string | null
  checkoutSessionId?: string | null
  subscription?: StripeSubscription | null
  paymentStatus?: string | null
  checkoutAddonKeys?: string[]
}

export async function activateBilling(admin: AdminClient, input: BillingActivationInput) {
  const subscriptionId = input.subscription?.id ?? null
  const subscriptionStatus = input.subscription?.status ?? 'active'
  const stripePriceId = input.subscription?.items?.data?.[0]?.price?.id ?? null
  const plan = getSubscriptionPlan(input.subscription)
  const addons = getSubscriptionAddons(input.subscription)
  const oneTimeAddons = getCheckoutOneTimeAddons(input.checkoutAddonKeys)
  const cadence = getSubscriptionCadence(input.subscription)
  const period = getSubscriptionUsagePeriod(input.subscription)
  const initialTopUp = oneTimeAddons.some((addon) => addon.key === 'plus_2000_messages') ? 2000 : 0

  await updateAccountBilling(admin, input.accountId, {
    status: stripeStatusToAccountStatus(subscriptionStatus),
    plan: 'essential',
    commercialPlan: plan.key,
    customerId: input.customerId,
    subscriptionId,
    checkoutSessionId: input.checkoutSessionId,
    subscriptionStatus,
    paymentStatus: input.paymentStatus,
    stripePriceId,
    cancelAtPeriodEnd: input.subscription?.cancel_at_period_end === true,
    cancelAt: input.subscription?.cancel_at ?? null,
    currentPeriodEnd: input.subscription?.current_period_end ?? null,
    currentPeriodStart: input.subscription?.current_period_start ?? null,
    billingCadence: cadence,
    purchasedOneTimeAddonKeys: oneTimeAddons.map((addon) => addon.key),
  })

  await admin
    .from('theatres')
    .update({ plan: 'essential' })
    .eq('id', input.tenantId)

  await admin
    .from('tenant_modules')
    .upsert(plan.moduleKeys.map((moduleKey) => ({
      theatre_id: input.tenantId,
      module_key: moduleKey,
      status: 'active',
      enabled_at: new Date().toISOString(),
      config: {},
    })), { onConflict: 'theatre_id,module_key' })

  await admin
    .from('tenant_subscriptions')
    .upsert({
      theatre_id: input.tenantId,
      plan: 'essential',
      status: stripeStatusToTenantSubscriptionStatus(subscriptionStatus),
      billing_period_start: period.startDate,
      billing_period_end: period.endDate,
      billing_period_start_at: period.startAt,
      billing_period_end_at: period.endAt,
      included_chat_conversations: getIncludedChatConversations(plan, addons) + initialTopUp,
      included_email_conversations: plan.includedEmailConversations,
      included_voice_minutes: 0,
      overage_price_chat_cents: 10,
      overage_price_email_cents: 12,
      overage_price_voice_minute_cents: 35,
      metadata: {
        stripe_customer_id: input.customerId ?? null,
        stripe_subscription_id: subscriptionId,
        stripe_checkout_session_id: input.checkoutSessionId ?? null,
        stripe_subscription_status: subscriptionStatus,
        stripe_cancel_at_period_end: input.subscription?.cancel_at_period_end === true,
        stripe_cancel_at: input.subscription?.cancel_at ?? null,
        stripe_current_period_end: input.subscription?.current_period_end ?? null,
        stripe_current_period_start: input.subscription?.current_period_start ?? null,
        stripe_price_id: stripePriceId,
        plan_key: plan.key,
        active_addons: addons.map((addon) => addon.key),
        purchased_one_time_addons: oneTimeAddons.map((addon) => addon.key),
        billing_cadence: cadence,
        message_top_up_checkout_sessions: initialTopUp && input.checkoutSessionId ? [input.checkoutSessionId] : [],
      },
    }, { onConflict: 'theatre_id,billing_period_start_at' })

  if (input.subscription) {
    await updateAccountActiveAddons(admin, input.accountId, addons, input.subscription)
  }
  await syncAddonEffects(admin, input.tenantId, addons)
}

export async function syncSubscriptionStatus(admin: AdminClient, subscription: StripeSubscription) {
  const tenantId = subscription.metadata?.tenant_id
  const accountId = subscription.metadata?.account_id
  if (!tenantId || !accountId) return

  const plan = getSubscriptionPlan(subscription)
  const addons = getSubscriptionAddons(subscription)
  const cadence = getSubscriptionCadence(subscription)
  const period = getSubscriptionUsagePeriod(subscription)
  const baseIncludedChat = getIncludedChatConversations(plan, addons)
  const { data: existingUsagePeriod } = await admin
    .from('tenant_subscriptions')
    .select('included_chat_conversations, metadata')
    .eq('theatre_id', tenantId)
    .eq('billing_period_start_at', period.startAt)
    .maybeSingle()
  const existingUsageMetadata = isPlainObject(existingUsagePeriod?.metadata) ? existingUsagePeriod.metadata : {}
  const preservedTopUp = Math.max(0, (existingUsagePeriod?.included_chat_conversations ?? baseIncludedChat) - baseIncludedChat)
  await updateAccountBilling(admin, accountId, {
    status: stripeStatusToAccountStatus(subscription.status),
    plan: 'essential',
    commercialPlan: plan.key,
    customerId: subscription.customer,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    stripePriceId: subscription.items?.data?.[0]?.price?.id ?? null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    cancelAt: subscription.cancel_at ?? null,
    currentPeriodEnd: subscription.current_period_end ?? null,
    currentPeriodStart: subscription.current_period_start ?? null,
    billingCadence: cadence,
  })

  await admin
    .from('tenant_subscriptions')
    .upsert({
      theatre_id: tenantId,
      plan: 'essential',
      status: stripeStatusToTenantSubscriptionStatus(subscription.status),
      billing_period_start: period.startDate,
      billing_period_end: period.endDate,
      billing_period_start_at: period.startAt,
      billing_period_end_at: period.endAt,
      included_chat_conversations: baseIncludedChat + preservedTopUp,
      included_email_conversations: plan.includedEmailConversations,
      included_voice_minutes: 0,
      metadata: {
        ...existingUsageMetadata,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
        stripe_cancel_at_period_end: subscription.cancel_at_period_end === true,
        stripe_cancel_at: subscription.cancel_at ?? null,
        stripe_current_period_end: subscription.current_period_end ?? null,
        stripe_current_period_start: subscription.current_period_start ?? null,
        stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
        plan_key: plan.key,
        active_addons: addons.map((addon) => addon.key),
        billing_cadence: cadence,
      },
    }, { onConflict: 'theatre_id,billing_period_start_at' })

  await activatePlanModules(admin, tenantId, plan)
  await updateAccountActiveAddons(admin, accountId, addons, subscription)
  await syncAddonEffects(admin, tenantId, addons)
}

export async function markSubscriptionCancelled(admin: AdminClient, subscription: StripeSubscription) {
  const tenantId = subscription.metadata?.tenant_id
  const accountId = subscription.metadata?.account_id
  if (!tenantId || !accountId) return

  await updateAccountBilling(admin, accountId, {
    status: 'cancelled',
    customerId: subscription.customer,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    stripePriceId: subscription.items?.data?.[0]?.price?.id ?? null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    currentPeriodEnd: subscription.current_period_end ?? null,
  })

  await admin
    .from('tenant_subscriptions')
    .update({
      status: 'cancelled',
      metadata: {
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
        stripe_cancel_at_period_end: false,
        stripe_cancel_at: null,
        stripe_current_period_end: subscription.current_period_end ?? null,
        stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
        active_addons: [],
      },
    })
    .eq('theatre_id', tenantId)
    .eq('status', 'active')

  await updateAccountActiveAddons(admin, accountId, [], subscription)
  await syncAddonEffects(admin, tenantId, [])
}

export function checkoutSessionToActivationInput(
  session: StripeCheckoutSession,
  subscription: StripeSubscription | null,
): BillingActivationInput | null {
  const tenantId = session.metadata?.tenant_id ?? subscription?.metadata?.tenant_id
  const accountId = session.metadata?.account_id ?? subscription?.metadata?.account_id
  if (!tenantId || !accountId) return null

  return {
    tenantId,
    accountId,
    customerId: session.customer ?? subscription?.customer ?? null,
    checkoutSessionId: session.id,
    subscription,
    paymentStatus: session.payment_status ?? null,
    checkoutAddonKeys: parseAddonKeys(session.metadata?.addon_keys),
  }
}

export async function applyOneTimeAddonPurchase(admin: AdminClient, session: StripeCheckoutSession) {
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return
  const tenantId = session.metadata?.tenant_id
  const accountId = session.metadata?.account_id
  const addonKeys = parseAddonKeys(session.metadata?.addon_keys)
  if (!tenantId || !accountId || !addonKeys.length) return

  if (addonKeys.includes('plus_2000_messages')) {
    const { getActiveSubscription } = await import('@/lib/usage/service')
    const active = await getActiveSubscription(admin, tenantId)
    if (!active.ok) throw new Error(active.error)
    const { error } = await admin.rpc('apply_chat_message_top_up', {
      p_subscription_id: active.subscription.id,
      p_checkout_session_id: session.id,
      p_messages: 2000,
    })
    if (error) throw new Error(error.message)
  }

  const { data: account } = await admin.from('accounts').select('metadata').eq('id', accountId).maybeSingle()
  const metadata = isPlainObject(account?.metadata) ? account.metadata : {}
  await admin.from('accounts').update({
    metadata: {
      ...metadata,
      purchased_one_time_addons: mergeStringLists(metadata.purchased_one_time_addons, addonKeys),
      one_time_checkout_sessions: mergeStringLists(metadata.one_time_checkout_sessions, [session.id]),
    },
  }).eq('id', accountId)
}

async function updateAccountBilling(
  admin: AdminClient,
  accountId: string,
  input: {
    status: 'trialing' | 'active' | 'paused' | 'cancelled'
    plan?: string
    commercialPlan?: string
    customerId?: string | null
    subscriptionId?: string | null
    checkoutSessionId?: string | null
    subscriptionStatus?: string | null
    paymentStatus?: string | null
    stripePriceId?: string | null
    cancelAtPeriodEnd?: boolean
    cancelAt?: number | null
    currentPeriodEnd?: number | null
    currentPeriodStart?: number | null
    billingCadence?: BillingCadence
    purchasedOneTimeAddonKeys?: string[]
  },
) {
  const { data: account } = await admin
    .from('accounts')
    .select('metadata')
    .eq('id', accountId)
    .maybeSingle()

  const metadata = isPlainObject(account?.metadata) ? account.metadata : {}
  await admin
    .from('accounts')
    .update({
      status: input.status,
      ...(input.plan ? { plan: input.plan } : {}),
      metadata: {
        ...metadata,
        stripe_customer_id: input.customerId ?? metadata.stripe_customer_id ?? null,
        stripe_subscription_id: input.subscriptionId ?? metadata.stripe_subscription_id ?? null,
        stripe_checkout_session_id: input.checkoutSessionId ?? metadata.stripe_checkout_session_id ?? null,
        stripe_subscription_status: input.subscriptionStatus ?? metadata.stripe_subscription_status ?? null,
        stripe_payment_status: input.paymentStatus ?? metadata.stripe_payment_status ?? null,
        stripe_price_id: input.stripePriceId ?? metadata.stripe_price_id ?? null,
        stripe_cancel_at_period_end: input.cancelAtPeriodEnd ?? metadata.stripe_cancel_at_period_end ?? false,
        stripe_cancel_at: input.cancelAt === undefined ? metadata.stripe_cancel_at ?? null : input.cancelAt,
        stripe_current_period_end: input.currentPeriodEnd === undefined
          ? metadata.stripe_current_period_end ?? null
          : input.currentPeriodEnd,
        stripe_current_period_start: input.currentPeriodStart === undefined
          ? metadata.stripe_current_period_start ?? null
          : input.currentPeriodStart,
        commercial_plan: input.commercialPlan ?? metadata.commercial_plan ?? null,
        billing_cadence: input.billingCadence ?? metadata.billing_cadence ?? 'monthly',
        purchased_one_time_addons: mergeStringLists(
          metadata.purchased_one_time_addons,
          input.purchasedOneTimeAddonKeys,
        ),
      },
    })
    .eq('id', accountId)
}

async function updateAccountActiveAddons(
  admin: AdminClient,
  accountId: string,
  addons: BillingAddon[],
  subscription: StripeSubscription,
) {
  const { data: account } = await admin
    .from('accounts')
    .select('metadata')
    .eq('id', accountId)
    .maybeSingle()

  const metadata = isPlainObject(account?.metadata) ? account.metadata : {}
  await admin
    .from('accounts')
    .update({
      metadata: {
        ...metadata,
        stripe_customer_id: subscription.customer ?? metadata.stripe_customer_id ?? null,
        active_addons: addons.map((addon) => addon.key),
      },
    })
    .eq('id', accountId)
}

async function syncAddonEffects(admin: AdminClient, tenantId: string, addons: BillingAddon[]) {
  await setWhiteLabel(admin, tenantId, addons.some((addon) => addon.key === 'white_label'))
}

async function setWhiteLabel(admin: AdminClient, tenantId: string, enabled: boolean) {
  const { data: theatre } = await admin
    .from('theatres')
    .select('widget_config')
    .eq('id', tenantId)
    .maybeSingle()

  const widgetConfig = isPlainObject(theatre?.widget_config) ? theatre.widget_config : {}
  await admin
    .from('theatres')
    .update({
      widget_config: {
        ...widgetConfig,
        whiteLabel: enabled,
      },
    })
    .eq('id', tenantId)
}

async function activatePlanModules(admin: AdminClient, tenantId: string, plan: BillingPlan) {
  await admin
    .from('tenant_modules')
    .upsert(plan.moduleKeys.map((moduleKey) => ({
      theatre_id: tenantId,
      module_key: moduleKey,
      status: 'active',
      enabled_at: new Date().toISOString(),
      config: {},
    })), { onConflict: 'theatre_id,module_key' })
}

export function getSubscriptionPeriod(subscription?: StripeSubscription | null) {
  if (!subscription?.current_period_start || !subscription.current_period_end) {
    return getCurrentBillingPeriod()
  }

  const start = new Date(subscription.current_period_start * 1000)
  const end = new Date(subscription.current_period_end * 1000)

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  }
}

export function getSubscriptionUsagePeriod(subscription?: StripeSubscription | null, referenceDate = new Date()) {
  const stripePeriod = getSubscriptionPeriod(subscription)
  if (getSubscriptionCadence(subscription) !== 'yearly') return stripePeriod

  const subscriptionStart = new Date(stripePeriod.startAt)
  const subscriptionEnd = new Date(stripePeriod.endAt)
  const reference = referenceDate < subscriptionStart
    ? subscriptionStart
    : referenceDate >= subscriptionEnd
      ? new Date(subscriptionEnd.getTime() - 1)
      : referenceDate

  let monthIndex = Math.max(0, (
    (reference.getUTCFullYear() - subscriptionStart.getUTCFullYear()) * 12
    + reference.getUTCMonth() - subscriptionStart.getUTCMonth()
  ))
  let start = addUtcMonthsClamped(subscriptionStart, monthIndex)
  if (start > reference && monthIndex > 0) {
    monthIndex -= 1
    start = addUtcMonthsClamped(subscriptionStart, monthIndex)
  }
  const end = new Date(Math.min(addUtcMonthsClamped(subscriptionStart, monthIndex + 1).getTime(), subscriptionEnd.getTime()))

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  }
}

function getSubscriptionCadence(subscription?: StripeSubscription | null): BillingCadence {
  if (subscription?.metadata?.billing_cadence === 'yearly') return 'yearly'
  const priceCadence = subscription?.items?.data
    ?.map((item) => getBillingCadenceByPriceId(item.price?.id))
    .find(Boolean)
  return priceCadence === 'yearly' ? 'yearly' : 'monthly'
}

function addUtcMonthsClamped(date: Date, months: number) {
  const targetYear = date.getUTCFullYear() + Math.floor((date.getUTCMonth() + months) / 12)
  const targetMonth = ((date.getUTCMonth() + months) % 12 + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(date.getUTCDate(), lastDay),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ))
}

function getSubscriptionPlan(subscription?: StripeSubscription | null) {
  const metadataPlan = getBillingPlan(subscription?.metadata?.plan_key)
  if (metadataPlan) return metadataPlan
  const itemPlan = subscription?.items?.data
    ?.map((item) => getBillingPlanByPriceId(item.price?.id))
    .find((plan): plan is BillingPlan => Boolean(plan))
  return itemPlan ?? getDefaultUpgradePlan()
}

function getSubscriptionAddons(subscription?: StripeSubscription | null) {
  const addons = new Map<string, BillingAddon>()
  for (const item of subscription?.items?.data ?? []) {
    const addon = getBillingAddonByPriceId(item.price?.id)
    if (addon) addons.set(addon.key, addon)
  }
  return Array.from(addons.values())
}

function getCheckoutOneTimeAddons(addonKeys: string[] | undefined) {
  const addons = new Map<string, BillingAddon>()
  for (const addonKey of addonKeys ?? []) {
    const addon = getBillingAddon(addonKey)
    if (addon?.billingMode === 'one_time') addons.set(addon.key, addon)
  }
  return Array.from(addons.values())
}

function getIncludedChatConversations(plan: BillingPlan, addons: BillingAddon[]) {
  return plan.includedChatConversations
    + addons.reduce((total, addon) => total + (addon.includedChatConversations ?? 0), 0)
}

function stripeStatusToAccountStatus(status: string): 'trialing' | 'active' | 'paused' | 'cancelled' {
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'canceled') return 'cancelled'
  return 'paused'
}

function stripeStatusToTenantSubscriptionStatus(status: string): 'trialing' | 'active' | 'paused' | 'cancelled' {
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'canceled') return 'cancelled'
  return 'paused'
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseAddonKeys(value: string | undefined) {
  if (!value) return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function mergeStringLists(current: Json | undefined, additions: string[] | undefined) {
  const values = new Set<string>()
  if (Array.isArray(current)) {
    for (const item of current) {
      if (typeof item === 'string') values.add(item)
    }
  }
  for (const item of additions ?? []) values.add(item)
  return Array.from(values)
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
