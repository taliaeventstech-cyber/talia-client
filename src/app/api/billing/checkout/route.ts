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
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/stripe/server'
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

    const plan = getBillingPlan(planKey)
    if (!plan || !isPublicBillingPlan(plan.key)) {
      return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
    }

    const cadence: BillingCadence = billingCadence === 'yearly' ? 'yearly' : 'monthly'
    const addons = (addonKeys ?? [])
      .map((addonKey) => getBillingAddon(addonKey))
      .filter((addon): addon is BillingAddon => Boolean(addon))
    await requireTenantBillingAccess(tenantId)

    const admin = createAdminClient()
    const { data: theatre, error } = await admin
      .from('theatres')
      .select('account_id, fallback_email, accounts(billing_email, metadata, market_country_code, billing_currency)')
      .eq('id', tenantId)
      .single()

    if (error || !theatre?.account_id) {
      return NextResponse.json({ error: error?.message ?? 'tenant_not_found' }, { status: 404 })
    }

    const account = Array.isArray(theatre.accounts) ? theatre.accounts[0] : theatre.accounts
    const marketCountry = normalizeCommercialMarketCountry(account?.market_country_code)
    const currency = getCommercialCurrency(marketCountry)
    const priceId = getStripePriceIdForPlan(plan, marketCountry, cadence)
    const addonPriceIds = addons.map((addon) => getStripePriceIdForAddon(addon, marketCountry, cadence))
    if (!isStripeConfigured() || !priceId || addonPriceIds.some((price) => !price)) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
    }
    const accountMetadata = isPlainObject(account?.metadata) ? account.metadata : {}
    const customerId = typeof accountMetadata.stripe_customer_id === 'string'
      ? accountMetadata.stripe_customer_id
      : undefined
    const origin = getAppOrigin(request)
    const session = await createStripeCheckoutSession({
      tenantId,
      accountId: theatre.account_id,
      planKey: plan.key,
      billingCadence: cadence,
      marketCountry,
      currency,
      priceId,
      addonKeys: addons.map((addon) => addon.key),
      addonPriceIds: addonPriceIds as string[],
      customerId,
      customerEmail: account?.billing_email ?? theatre.fallback_email,
      successUrl: `${origin}/${tenantId}/upgrade?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/${tenantId}/upgrade?checkout=cancelled`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'checkout_url_missing' }, { status: 502 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[billing-checkout]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'checkout_failed' },
      { status: 500 },
    )
  }
}

function getAppOrigin(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  return request.nextUrl.origin
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
