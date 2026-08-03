import { requireTenantBillingAccess } from '@/lib/auth/tenant-access'
import {
  getBillingAddon,
  getBillingPlan,
  getStripePriceIdForAddon,
  getStripePriceIdForPlan,
  isPublicBillingPlan,
  type BillingAddon,
  type BillingCadence,
} from '@/lib/billing/plans'
import { getCommercialCurrency, normalizeCommercialMarketCountry } from '@/lib/billing/market'
import { syncSubscriptionStatus } from '@/lib/billing/stripe-sync'
import { createAdminClient } from '@/lib/supabase/admin'
import { retrieveStripeSubscription, updateStripeSubscription } from '@/lib/stripe/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { tenantId, planKey, addonKeys, billingCadence } = await request.json() as {
      tenantId?: string
      planKey?: string
      addonKeys?: string[]
      billingCadence?: BillingCadence
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id_required' }, { status: 400 })
    }

    const access = await requireTenantBillingAccess(tenantId)
    if (!access.billingAccess.isPaid) {
      return NextResponse.json({ error: 'paid_plan_required' }, { status: 403 })
    }

    const plan = getBillingPlan(planKey)
    if (!plan || !isPublicBillingPlan(plan.key)) {
      return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
    }

    const cadence: BillingCadence = billingCadence === 'yearly' ? 'yearly' : 'monthly'

    const addons = (addonKeys ?? [])
      .map((addonKey) => getBillingAddon(addonKey))
      .filter((addon): addon is BillingAddon => Boolean(addon))
      .filter((addon) => addon.billingMode === 'recurring')
    const admin = createAdminClient()
    const { data: theatre, error } = await admin
      .from('theatres')
      .select('account_id, accounts(metadata, market_country_code, billing_currency)')
      .eq('id', tenantId)
      .single()

    if (error || !theatre?.account_id) {
      return NextResponse.json({ error: error?.message ?? 'tenant_not_found' }, { status: 404 })
    }

    const account = Array.isArray(theatre.accounts) ? theatre.accounts[0] : theatre.accounts
    const marketCountry = normalizeCommercialMarketCountry(account?.market_country_code)
    const currency = getCommercialCurrency(marketCountry)
    const planPriceId = getStripePriceIdForPlan(plan, marketCountry, cadence)
    const addonPriceIds = addons.map((addon) => getStripePriceIdForAddon(addon, marketCountry, cadence))
    if (!process.env.STRIPE_SECRET_KEY || !planPriceId || addonPriceIds.some((price) => !price)) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
    }
    const metadata = isPlainObject(account?.metadata) ? account.metadata : {}
    const subscriptionId = typeof metadata.stripe_subscription_id === 'string'
      ? metadata.stripe_subscription_id
      : null

    if (!subscriptionId) {
      return NextResponse.json({ error: 'stripe_subscription_missing' }, { status: 409 })
    }

    const currentSubscription = await retrieveStripeSubscription(subscriptionId)
    const updatedSubscription = await updateStripeSubscription({
      subscriptionId,
      planKey: plan.key,
      planPriceId,
      addonPriceIds: addonPriceIds as string[],
      currentSubscription,
      billingCadence: cadence,
      marketCountry,
      currency,
    })

    await syncSubscriptionStatus(admin, updatedSubscription)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[billing-update-subscription]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'update_subscription_failed' },
      { status: 500 },
    )
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
