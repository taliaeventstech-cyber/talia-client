import {
  activateBilling,
  applyOneTimeAddonPurchase,
  checkoutSessionToActivationInput,
  markSubscriptionCancelled,
  syncSubscriptionStatus,
} from '@/lib/billing/stripe-sync'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getStripeWebhookSecret,
  retrieveStripeSubscription,
  verifyStripeWebhookPayload,
  type StripeCheckoutSession,
  type StripeInvoice,
  type StripeSubscription,
} from '@/lib/stripe/server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secret = getStripeWebhookSecret()
  if (!secret) {
    return NextResponse.json({ error: 'stripe_webhook_secret_missing' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'stripe_signature_missing' }, { status: 400 })
  }

  const payload = await request.text()
  let event
  try {
    event = verifyStripeWebhookPayload(payload, signature, secret)
  } catch (error) {
    console.error('[stripe-webhook-signature]', error)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as StripeCheckoutSession
      if (session.metadata?.checkout_kind === 'addon_purchase') {
        await applyOneTimeAddonPurchase(admin, session)
        return NextResponse.json({ received: true })
      }
      const subscription = session.subscription
        ? await retrieveStripeSubscription(session.subscription)
        : null
      const activationInput = checkoutSessionToActivationInput(session, subscription)
      if (activationInput) {
        await activateBilling(admin, activationInput)
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await syncSubscriptionStatus(admin, event.data.object as StripeSubscription)
    }

    if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as StripeInvoice
      if (invoice.subscription) {
        const subscription = await retrieveStripeSubscription(invoice.subscription)
        await syncSubscriptionStatus(admin, subscription)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      await markSubscriptionCancelled(admin, event.data.object as StripeSubscription)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe-webhook-handler]', event.type, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'webhook_handler_failed' },
      { status: 500 },
    )
  }
}
