import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { canManageAccountBilling } from '@/lib/billing/permissions'
import {
  BILLING_ADDONS,
  BILLING_PLANS,
  getBillingAddonPrice,
  getBillingPlanPrice,
  isPublicBillingPlan,
  isStripeConfiguredForAddon,
  isStripeConfiguredForPlan,
  type BillingCadence,
} from '@/lib/billing/plans'
import { getCommercialCurrency } from '@/lib/billing/market'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getIntlLocale } from '@/lib/i18n/config'
import type { BillingAddonKey } from '@/lib/billing/plans'
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
  const currentAddonKeys = getCurrentAddonKeys(metadata.active_addons)
  const cancellationAt = getCancellationAt(metadata)
  const marketCountry = access.accountMarketCountry ?? 'ES'
  const currency = getCommercialCurrency(marketCountry)
  const currentCadence: BillingCadence = metadata.billing_cadence === 'yearly' ? 'yearly' : 'monthly'

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
        addons={BILLING_ADDONS.map((addon) => ({
          key: addon.key,
          title: copy.addons[addon.key].title,
          monthlyPrice: getBillingAddonPrice(addon, marketCountry, 'monthly')?.amount,
          yearlyPrice: getBillingAddonPrice(addon, marketCountry, 'yearly')?.amount,
          oneTimePrice: addon.billingMode === 'one_time' ? getBillingAddonPrice(addon, marketCountry)?.amount : undefined,
          description: copy.addons[addon.key].description,
          billingMode: addon.billingMode,
          monthlyConfigured: isStripeConfiguredForAddon(addon, marketCountry, 'monthly'),
          yearlyConfigured: isStripeConfiguredForAddon(addon, marketCountry, 'yearly'),
          disabledForPaid: access.billingAccess.isPaid && addon.key === 'onboarding_premium',
        }))}
        checkoutLabels={copy.checkout}
        billingLabels={copy.billing}
        cancellationAt={cancellationAt}
        cancellationScheduled={metadata.stripe_cancel_at_period_end === true}
        canManageBilling={canManageAccountBilling(access)}
        currentAddonKeys={currentAddonKeys}
        currentCadence={currentCadence}
        currentPlanKey="chatbot_web"
        isPaid={access.billingAccess.isPaid}
        locale={getIntlLocale(locale)}
        currency={currency}
        monthlyLabel={copy.monthly}
        yearlyLabel={copy.yearly}
        cadenceMonthlyLabel={copy.cadenceMonthly}
        cadenceYearlyLabel={copy.cadenceYearly}
        equivalentMonthlyLabel={copy.equivalentMonthly}
        oneTimeLabel={copy.oneTime}
        paidAddonsLabel={copy.paidAddons}
        planDetailsLabel={copy.planDetails}
        plans={BILLING_PLANS.filter((plan) => isPublicBillingPlan(plan.key)).map((plan) => ({
          key: plan.key,
          title: copy.plans[plan.key].title,
          monthlyPrice: getBillingPlanPrice(plan, marketCountry, 'monthly')?.amount,
          yearlyPrice: getBillingPlanPrice(plan, marketCountry, 'yearly')?.amount,
          includedLabel: copy.plans[plan.key].includedLabel,
          features: copy.plans[plan.key].features,
          highlighted: true,
          monthlyConfigured: isStripeConfiguredForPlan(plan, marketCountry, 'monthly'),
          yearlyConfigured: isStripeConfiguredForPlan(plan, marketCountry, 'yearly'),
        }))}
        popularLabel={copy.popular}
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

function getCurrentAddonKeys(value: unknown): BillingAddonKey[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is BillingAddonKey => (
    item === 'white_label'
    || item === 'plus_2000_messages'
    || item === 'onboarding_premium'
  ))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
