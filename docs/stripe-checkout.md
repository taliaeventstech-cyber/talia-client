# Stripe Checkout

TALIA uses Stripe Checkout from the upgrade screen, once the trial has ended or when the client decides to move to a paid plan.

## Environment variables

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_CHATBOT_LITE_PRICE_ID=price_...
STRIPE_CHATBOT_MAIL_LITE_PRICE_ID=price_...
STRIPE_MAIL_LITE_PRICE_ID=price_...
STRIPE_WHITELABEL_PRICE_ID=price_...
STRIPE_PLUS_2000_MESSAGES_PRICE_ID=price_...
STRIPE_ONBOARDING_PREMIUM_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://app.talia...
```

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
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

The webhook validates `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`.

The commercial plan is sent in Stripe metadata as `plan_key` and stored in `accounts.metadata.commercial_plan`. The `accounts.plan`, `theatres.plan`, and `tenant_subscriptions.plan` columns keep values compatible with the existing schema.

Add-ons are sent as Stripe line items alongside the base plan and are synced from the subscription's active items. They are stored in `accounts.metadata.active_addons` and in `tenant_subscriptions.metadata.active_addons`. Currently:

- `white_label`: activates `widget_config.whiteLabel`.
- `plus_2000_messages`: adds 2,000 conversations to the chatbot's monthly limit while the recurring item is active.
- `onboarding_premium`: one-time payment included only in the initial checkout.

## Checkout endpoints

Initial plan signup, with or without add-ons:

```text
POST /api/billing/checkout
```

Plan change or recurring add-ons on an existing subscription:

```text
POST /api/billing/update-subscription
```

`update-subscription` only modifies recurring add-ons. One-time payments, such as `onboarding_premium`, are not added to an already-created subscription.

## Restricted key

If a restricted API key is used instead of a full secret key, it needs permissions to:

- Create Checkout Sessions.
- Read Subscriptions.
- Read Customers, if the saved customer is to be reused.

The webhook doesn't use scopes: it's configured by events in Stripe and signs calls with the webhook secret.

## Local sandbox

Stripe cannot call `localhost` from the Dashboard. To test locally, use the Stripe CLI:

```bash
stripe listen \
  --forward-to localhost:3001/api/billing/stripe/webhook \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed
```

The CLI will print a `whsec_...` value. Copy that value into:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

For production or preview, create an endpoint in the Stripe Dashboard with:

```text
https://YOUR_DOMAIN/api/billing/stripe/webhook
```
