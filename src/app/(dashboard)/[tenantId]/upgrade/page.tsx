import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { BILLING_ADDONS, BILLING_PLANS, isStripeConfiguredForAddon, isStripeConfiguredForPlan } from '@/lib/billing/plans'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import type { BillingAddonKey, BillingPlanKey } from '@/lib/billing/plans'
import { BillingConfigurator } from './billing-configurator'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function UpgradePage({ params }: Props) {
  const { tenantId } = await params
  const access = await requireTenantPermission(tenantId, 'view_overview')
  const dictionary = await getDictionary(await getLocale())
  const copy = dictionary.upgrade
  const metadata = isPlainObject(access.accountMetadata) ? access.accountMetadata : {}
  const currentPlanKey = getCurrentPlanKey(metadata.commercial_plan)
  const currentAddonKeys = getCurrentAddonKeys(metadata.active_addons)

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
        currentAddonKeys={currentAddonKeys}
        currentPlanKey={currentPlanKey}
        isPaid={access.billingAccess.isPaid}
        monthlyLabel={copy.monthly}
        oneTimeLabel={copy.oneTime}
        paidAddonsLabel={copy.paidAddons}
        planDetailsLabel={copy.planDetails}
        plans={BILLING_PLANS.map((plan) => ({
          key: plan.key,
          title: copy.plans[plan.key].title,
          priceMonthly: plan.priceMonthly,
          includedLabel: copy.plans[plan.key].includedLabel,
          features: copy.plans[plan.key].features,
          highlighted: plan.highlighted,
          disabled: !isStripeConfiguredForPlan(plan),
        }))}
        popularLabel={copy.popular}
        tenantId={tenantId}
      />
    </main>
  )
}

function getCurrentPlanKey(value: unknown): BillingPlanKey {
  if (value === 'chatbot_web' || value === 'chatbot_email' || value === 'email_agent') return value
  return 'chatbot_email'
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
