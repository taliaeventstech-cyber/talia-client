import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { canManageAccountBilling } from '@/lib/billing/permissions'
import { BILLING_PLANS, getBillingPlan, getBillingPlanPrice, isPublicBillingPlan, isStripeConfiguredForPlan } from '@/lib/billing/plans'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getIntlLocale } from '@/lib/i18n/config'
import { BillingConfigurator } from './billing-configurator'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function UpgradePage({ params }: Props) {
  const { tenantId } = await params
  const access = await requireTenantPermission(tenantId, 'view_overview')
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.upgrade
  const metadata = isPlainObject(access.accountMetadata) ? access.accountMetadata : {}
  const currentPlan = getBillingPlan(typeof metadata.commercial_plan === 'string' ? metadata.commercial_plan : null)
  const cancellationAt = getCancellationAt(metadata)
  const marketCountry = access.accountMarketCountry ?? 'ES'
  const intlLocale = getIntlLocale(locale)

  return (
    <main className="page-shell upgrade-shell">
      <header className="upgrade-header">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        {access.billingAccess.isTrialExpired ? (
          <p className="muted">{copy.trialExpired}</p>
        ) : (
          <p className="muted">{copy.trialActive}</p>
        )}
      </header>

      <BillingConfigurator
        checkoutLabels={copy.checkout}
        billingLabels={copy.billing}
        cancellationAt={cancellationAt}
        cancellationScheduled={metadata.stripe_cancel_at_period_end === true}
        canManageBilling={canManageAccountBilling(access)}
        currentPlanKey={currentPlan?.key ?? 'basic'}
        isPaid={access.billingAccess.isPaid}
        locale={intlLocale}
        monthlyLabel={copy.monthly}
        planDetailsLabel={copy.planDetails}
        plans={BILLING_PLANS.filter((plan) => isPublicBillingPlan(plan.key)).map((plan) => {
          const commercialPrice = getBillingPlanPrice(plan, marketCountry, 'monthly')
          return {
            key: plan.key,
            title: copy.plans[plan.key].title,
            includedLabel: copy.plans[plan.key].includedLabel,
            features: copy.plans[plan.key].features,
            highlighted: plan.highlighted,
            monthlyConfigured: isStripeConfiguredForPlan(plan, marketCountry, 'monthly'),
            priceLabel: commercialPrice?.amount === null || commercialPrice === undefined
              ? copy.pricePending
              : formatCommercialPrice(commercialPrice.amount, commercialPrice.currency, intlLocale),
          }
        })}
        popularLabel={copy.popular}
        pricePendingLabel={copy.pricePending}
        tenantId={tenantId}
      />
    </main>
  )
}

function getCancellationAt(metadata: Record<string, unknown>) {
  const value = typeof metadata.stripe_cancel_at === 'number'
    ? metadata.stripe_cancel_at
    : metadata.stripe_current_period_end
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  return new Date(value * 1000).toISOString()
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatCommercialPrice(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}
