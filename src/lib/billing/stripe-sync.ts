import type { createAdminClient } from '@/lib/supabase/admin'
import {
  getBillingAddon,
  getBillingAddonByPriceId,
  getBillingPlan,
  getBillingPlanByPriceId,
  getDefaultUpgradePlan,
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
  const period = getSubscriptionPeriod(input.subscription)

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
      included_chat_conversations: getIncludedChatConversations(plan, addons),
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
        stripe_price_id: stripePriceId,
        plan_key: plan.key,
        active_addons: addons.map((addon) => addon.key),
        purchased_one_time_addons: oneTimeAddons.map((addon) => addon.key),
      },
    }, { onConflict: 'theatre_id,billing_period_start' })

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
  const period = getSubscriptionPeriod(subscription)
  await updateAccountBilling(admin, accountId, {
    status: stripeStatusToAccountStatus(subscription.status),
    plan: 'essential',
    commercialPlan: plan.key,
    customerId: subscription.customer,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    stripePriceId: subscription.items?.data?.[0]?.price?.id ?? null,
  })

  await admin
    .from('tenant_subscriptions')
    .upsert({
      theatre_id: tenantId,
      plan: 'essential',
      status: stripeStatusToTenantSubscriptionStatus(subscription.status),
      billing_period_start: period.startDate,
      billing_period_end: period.endDate,
      included_chat_conversations: getIncludedChatConversations(plan, addons),
      included_email_conversations: plan.includedEmailConversations,
      included_voice_minutes: 0,
      metadata: {
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
        stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
        plan_key: plan.key,
        active_addons: addons.map((addon) => addon.key),
      },
    }, { onConflict: 'theatre_id,billing_period_start' })

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
  })

  await admin
    .from('tenant_subscriptions')
    .update({
      status: 'cancelled',
      metadata: {
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
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
        commercial_plan: input.commercialPlan ?? metadata.commercial_plan ?? null,
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

function getSubscriptionPeriod(subscription?: StripeSubscription | null) {
  if (!subscription?.current_period_start || !subscription.current_period_end) {
    return getCurrentBillingPeriod()
  }

  return {
    startDate: toDateString(new Date(subscription.current_period_start * 1000)),
    endDate: toDateString(new Date(subscription.current_period_end * 1000)),
  }
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
