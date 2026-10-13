# Stripe Checkout

TALIA uses Stripe Checkout from the upgrade screen, once the trial has ended or when the client decides to move to a paid plan.

## Environment variables

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_BASIC_MEXICO_PRICE_ID=price_...
STRIPE_PREMIUM_MEXICO_PRICE_ID=price_...
STRIPE_BASIC_BRAZIL_PRICE_ID=price_...
STRIPE_PREMIUM_BRAZIL_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://app.talia...
```

The Stripe Customer Portal must be enabled in the same Stripe account. Its
subscription cancellation setting must cancel **at the end of the billing
period**, so customers retain access for the time they have already paid.

Locally, `NEXT_PUBLIC_APP_URL` must point to the actual port where Next is running, for example:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Webhook

Endpoint:

```text
POST /api/billing/stripe/webhook
```

Required events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

The webhook validates `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`.

The commercial plan is sent in Stripe metadata as `plan_key` and stored in `accounts.metadata.commercial_plan`. The `accounts.plan`, `theatres.plan`, and `tenant_subscriptions.plan` columns keep values compatible with the existing schema.

The onboarding stores the account's initial commercial market and currency.
Existing accounts remain in EUR. Checkout must use the Stripe Price configured
for that currency; the billing country and tax details are collected by Stripe
at payment time, rather than being assumed from the product interface language.

The public offer has two monthly plans in Spain: `basic` at EUR 60/month
(2,000 web messages) and `premium` at EUR 120/month (10,000 web messages).
Their Stripe Price IDs are intentionally kept in environment variables. Mexico
and Brazil retain independent Price IDs and remain price-on-request until their
local commercial amounts are approved.

## Checkout endpoints

Initial plan signup:

```text
POST /api/billing/checkout
```

Plan change on an existing subscription:

```text
POST /api/billing/update-subscription
```

Create a short-lived Stripe Customer Portal session for billing management or
the explicit subscription cancellation flow:

```text
POST /api/billing/customer-portal
```

The endpoint accepts `flow=manage|cancel`, reads the Stripe customer and
subscription identifiers from server-side account metadata, and is restricted
to the account owner according to `account_memberships.role`. The browser never supplies a Stripe customer or
subscription ID.

Backstage uses a separate administrative path. Being present in
`platform_admins` is not enough: the operator must also have the explicit
`manage_customer_billing` capability. Administrative cancellation reads the
subscription ID from trusted account metadata, verifies it with Stripe, requires
a reason and typed confirmation, synchronizes the returned subscription state,
writes an `audit_events` entry and attempts to notify `accounts.billing_email`.
Period-end cancellation is the recommended default; immediate cancellation is
available only through the stronger `CANCELAR AHORA` confirmation.

Customer notifications use `RESEND_API_KEY` and
`TALIA_BILLING_FROM_EMAIL` (falling back to `TALIA_SUPPORT_FROM_EMAIL`). Email
delivery failure is recorded but does not roll back a successful Stripe change.

When cancellation is scheduled, Stripe emits `customer.subscription.updated`
with `cancel_at_period_end=true`. TALIA stores the end date and keeps the product
active. At period end, `customer.subscription.deleted` marks the account and
tenant subscription as cancelled and removes recurring add-on effects.

The current public offer uses monthly Stripe prices. The Basic and Premium
message allowances reset each billing period.

## Restricted key

If a restricted API key is used instead of a full secret key, it needs permissions to:

- Create Checkout Sessions.
- Read and write Subscriptions (plan changes and administrative cancellation).
- Read Customers, if the saved customer is to be reused.
- Create Billing Portal Sessions.

The webhook doesn't use scopes: it's configured by events in Stripe and signs calls with the webhook secret.

## Local sandbox

Stripe cannot call `localhost` from the Dashboard. To test locally, use the Stripe CLI:

```bash
stripe listen \
  --forward-to localhost:3001/api/billing/stripe/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed
```

The CLI will print a `whsec_...` value. Copy that value into:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

For production or preview, create an endpoint in the Stripe Dashboard with:

```text
https://YOUR_DOMAIN/api/billing/stripe/webhook
```
