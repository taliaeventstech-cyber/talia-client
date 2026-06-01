# Stripe Checkout

TALIA usa Stripe Checkout desde la pantalla de upgrade, una vez terminado el trial o cuando el cliente decide pasar a un plan de pago.

## Variables de entorno

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

En local, `NEXT_PUBLIC_APP_URL` debe apuntar al puerto real donde corre Next, por ejemplo:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Webhook

Endpoint:

```text
POST /api/billing/stripe/webhook
```

Eventos necesarios:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

El webhook valida `Stripe-Signature` con `STRIPE_WEBHOOK_SECRET`.

El plan comercial se envía en metadata de Stripe como `plan_key` y se guarda en `accounts.metadata.commercial_plan`. Las columnas `accounts.plan`, `theatres.plan` y `tenant_subscriptions.plan` mantienen valores compatibles con el esquema existente.

Los extras se envían como line items de Stripe junto al plan base y se sincronizan desde los items activos de la suscripción. Se guardan en `accounts.metadata.active_addons` y en `tenant_subscriptions.metadata.active_addons`. Actualmente:

- `white_label`: activa `widget_config.whiteLabel`.
- `plus_2000_messages`: suma 2.000 conversaciones al límite mensual del chatbot mientras el item recurrente esté activo.
- `onboarding_premium`: pago único incluido sólo en el checkout inicial.

## Checkout endpoints

Alta inicial de plan, con o sin extras:

```text
POST /api/billing/checkout
```

Cambio de plan o add-ons recurrentes en una suscripción existente:

```text
POST /api/billing/update-subscription
```

`update-subscription` sólo modifica add-ons recurrentes. Los pagos únicos, como `onboarding_premium`, no se añaden a una suscripción ya creada.

## Restricted key

Si se usa una restricted API key en vez de una secret key completa, necesita permisos para:

- Crear Checkout Sessions.
- Leer Subscriptions.
- Leer Customers, si se quiere reutilizar el customer guardado.

El webhook no usa scopes: se configura por eventos en Stripe y firma las llamadas con el webhook secret.

## Sandbox local

Stripe no puede llamar a `localhost` desde el Dashboard. Para probar en local usa Stripe CLI:

```bash
stripe listen \
  --forward-to localhost:3001/api/billing/stripe/webhook \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed
```

La CLI imprimirá un valor `whsec_...`. Copia ese valor en:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

Para producción o preview, crea un endpoint en Stripe Dashboard con:

```text
https://TU_DOMINIO/api/billing/stripe/webhook
```
