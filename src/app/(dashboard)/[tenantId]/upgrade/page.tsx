import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { canManageAccountBilling } from '@/lib/billing/permissions'
import { BILLING_ADDONS, BILLING_PLANS, isPublicBillingPlan, isStripeConfiguredForAddon, isStripeConfiguredForPlan } from '@/lib/billing/plans'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getIntlLocale, type Locale } from '@/lib/i18n/config'
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
  const cancellationDate = getCancellationDate(metadata, locale)

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
          priceMonthly: addon.priceMonthly,
          priceOneTime: addon.priceOneTime,
          description: copy.addons[addon.key].description,
          billingMode: addon.billingMode,
          disabled: !isStripeConfiguredForAddon(addon) || (access.billingAccess.isPaid && addon.billingMode === 'one_time'),
        }))}
        checkoutLabels={copy.checkout}
        billingLabels={copy.billing}
        cancellationDate={cancellationDate}
        cancellationScheduled={metadata.stripe_cancel_at_period_end === true}
        canManageBilling={canManageAccountBilling(access)}
        currentAddonKeys={currentAddonKeys}
        currentPlanKey="chatbot_web"
        isPaid={access.billingAccess.isPaid}
        monthlyLabel={copy.monthly}
        oneTimeLabel={copy.oneTime}
        paidAddonsLabel={copy.paidAddons}
        planDetailsLabel={copy.planDetails}
        plans={BILLING_PLANS.filter((plan) => isPublicBillingPlan(plan.key)).map((plan) => ({
          key: plan.key,
          title: copy.plans[plan.key].title,
          priceMonthly: plan.priceMonthly,
          includedLabel: copy.plans[plan.key].includedLabel,
          features: copy.plans[plan.key].features,
          highlighted: true,
          disabled: !isStripeConfiguredForPlan(plan),
        }))}
        popularLabel={copy.popular}
        tenantId={tenantId}
      />
    </main>
  )
}

function getCancellationDate(metadata: Record<string, unknown>, locale: Locale) {
  const value = typeof metadata.stripe_cancel_at === 'number'
    ? metadata.stripe_cancel_at
    : metadata.stripe_current_period_end
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  return new Intl.DateTimeFormat(
    getIntlLocale(locale),
    { dateStyle: 'long' },
  ).format(new Date(value * 1000))
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
