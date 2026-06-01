import { requireTenantPermission } from '@/lib/auth/tenant-access'
import {
  getBillingAddon,
  getBillingPlan,
  getStripePriceIdForAddon,
  getStripePriceIdForPlan,
  type BillingAddon,
} from '@/lib/billing/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/stripe/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { tenantId, planKey, addonKeys } = await request.json() as { tenantId?: string; planKey?: string; addonKeys?: string[] }
    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id_required' }, { status: 400 })
    }

    const plan = getBillingPlan(planKey)
    if (!plan) {
      return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
    }

    const priceId = getStripePriceIdForPlan(plan)
    if (!isStripeConfigured() || !priceId) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
    }
    const addons = (addonKeys ?? [])
      .map((addonKey) => getBillingAddon(addonKey))
      .filter((addon): addon is BillingAddon => Boolean(addon))
    const addonPriceIds = addons
      .map((addon) => getStripePriceIdForAddon(addon))
      .filter((addonPriceId): addonPriceId is string => Boolean(addonPriceId))

    await requireTenantPermission(tenantId, 'view_overview')

    const admin = createAdminClient()
    const { data: theatre, error } = await admin
      .from('theatres')
      .select('account_id, fallback_email, accounts(billing_email, metadata)')
      .eq('id', tenantId)
      .single()

    if (error || !theatre?.account_id) {
      return NextResponse.json({ error: error?.message ?? 'tenant_not_found' }, { status: 404 })
    }

    const account = Array.isArray(theatre.accounts) ? theatre.accounts[0] : theatre.accounts
    const accountMetadata = isPlainObject(account?.metadata) ? account.metadata : {}
    const customerId = typeof accountMetadata.stripe_customer_id === 'string'
      ? accountMetadata.stripe_customer_id
      : undefined
    const origin = getAppOrigin(request)
    const session = await createStripeCheckoutSession({
      tenantId,
      accountId: theatre.account_id,
      planKey: plan.key,
      priceId,
      addonKeys: addons.map((addon) => addon.key),
      addonPriceIds,
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
