import { requireTenantBillingAccess } from '@/lib/auth/tenant-access'
import { getBillingAddon, getStripePriceIdForAddon } from '@/lib/billing/plans'
import { getCommercialCurrency, normalizeCommercialMarketCountry } from '@/lib/billing/market'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeOneTimeCheckoutSession, isStripeConfigured } from '@/lib/stripe/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { tenantId, addonKey } = await request.json() as { tenantId?: string; addonKey?: string }
    if (!tenantId) return NextResponse.json({ error: 'tenant_id_required' }, { status: 400 })

    const addon = getBillingAddon(addonKey)
    if (!addon || addon.billingMode !== 'one_time') {
      return NextResponse.json({ error: 'invalid_addon' }, { status: 400 })
    }

    const access = await requireTenantBillingAccess(tenantId)
    if (!access.billingAccess.isPaid) {
      return NextResponse.json({ error: 'paid_plan_required' }, { status: 403 })
    }

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
    const priceId = getStripePriceIdForAddon(addon, marketCountry)
    if (!isStripeConfigured() || !priceId) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
    }

    const metadata = isPlainObject(account?.metadata) ? account.metadata : {}
    const customerId = typeof metadata.stripe_customer_id === 'string' ? metadata.stripe_customer_id : undefined
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? request.nextUrl.origin
    const session = await createStripeOneTimeCheckoutSession({
      tenantId,
      accountId: theatre.account_id,
      addonKey: addon.key,
      priceId,
      marketCountry,
      currency,
      customerId,
      customerEmail: account?.billing_email ?? theatre.fallback_email,
      successUrl: `${origin}/${tenantId}/upgrade?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/${tenantId}/upgrade?checkout=cancelled`,
    })

    if (!session.url) return NextResponse.json({ error: 'checkout_url_missing' }, { status: 502 })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[billing-addon-checkout]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'checkout_failed' }, { status: 500 })
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
