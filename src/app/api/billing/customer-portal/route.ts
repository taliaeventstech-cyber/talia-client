import { requireTenantBillingAccess } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeCustomerPortalSession, isStripeConfigured } from '@/lib/stripe/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { tenantId, flow } = await request.json() as {
      tenantId?: string
      flow?: 'manage' | 'cancel'
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id_required' }, { status: 400 })
    }
    if (flow !== 'manage' && flow !== 'cancel') {
      return NextResponse.json({ error: 'invalid_portal_flow' }, { status: 400 })
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
    }

    const access = await requireTenantBillingAccess(tenantId)
    if (!access.billingAccess.isPaid) {
      return NextResponse.json({ error: 'paid_plan_required' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: theatre, error } = await admin
      .from('theatres')
      .select('account_id, accounts(metadata)')
      .eq('id', tenantId)
      .single()

    if (error || !theatre?.account_id) {
      return NextResponse.json({ error: error?.message ?? 'tenant_not_found' }, { status: 404 })
    }

    const account = Array.isArray(theatre.accounts) ? theatre.accounts[0] : theatre.accounts
    const metadata = isPlainObject(account?.metadata) ? account.metadata : {}
    const customerId = getMetadataString(metadata, 'stripe_customer_id')
    const subscriptionId = getMetadataString(metadata, 'stripe_subscription_id')

    if (!customerId) {
      return NextResponse.json({ error: 'stripe_customer_missing' }, { status: 409 })
    }
    if (flow === 'cancel' && !subscriptionId) {
      return NextResponse.json({ error: 'stripe_subscription_missing' }, { status: 409 })
    }

    const returnUrl = `${getAppOrigin(request)}/${tenantId}/upgrade?billing=returned`
    const session = await createStripeCustomerPortalSession({
      customerId,
      subscriptionId: subscriptionId ?? undefined,
      flow,
      returnUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[billing-customer-portal]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'customer_portal_failed' },
      { status: 500 },
    )
  }
}

function getAppOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? request.nextUrl.origin
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value ? value : null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
