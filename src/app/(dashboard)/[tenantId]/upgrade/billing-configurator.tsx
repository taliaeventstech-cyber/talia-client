'use client'

import type { BillingAddonKey, BillingCadence, BillingPlanKey } from '@/lib/billing/plans'
import type { CommercialCurrency } from '@/lib/billing/market'
import { LocalDateTime } from '@/components/local-date-time'
import { Check } from 'lucide-react'
import { useState } from 'react'

type PlanView = {
  key: BillingPlanKey
  title: string
  monthlyPrice?: number
  yearlyPrice?: number
  includedLabel: string
  features: readonly string[]
  highlighted?: boolean
  monthlyConfigured: boolean
  yearlyConfigured: boolean
}

type AddonView = {
  key: BillingAddonKey
  title: string
  monthlyPrice?: number
  yearlyPrice?: number
  oneTimePrice?: number
  description: string
  billingMode: 'recurring' | 'one_time'
  monthlyConfigured: boolean
  yearlyConfigured: boolean
  disabledForPaid: boolean
}

export function BillingConfigurator({
  addons,
  billingLabels,
  cancellationAt,
  cancellationScheduled,
  canManageBilling,
  checkoutLabels,
  currentAddonKeys,
  currentCadence,
  currentPlanKey,
  isPaid,
  locale,
  currency,
  monthlyLabel,
  yearlyLabel,
  cadenceMonthlyLabel,
  cadenceYearlyLabel,
  equivalentMonthlyLabel,
  oneTimeLabel,
  paidAddonsLabel,
  planDetailsLabel,
  plans,
  popularLabel,
  tenantId,
}: {
  addons: AddonView[]
  checkoutLabels: {
    idle: string
    pending: string
    disabled: string
    error: string
    ownerOnly: string
    buy: string
  }
  billingLabels: {
    title: string
    description: string
    manage: string
    cancel: string
    opening: string
    error: string
    scheduled: string
    scheduledWithoutDate: string
    ownerOnly: string
  }
  cancellationAt: string | null
  cancellationScheduled: boolean
  canManageBilling: boolean
  currentAddonKeys: BillingAddonKey[]
  currentCadence: BillingCadence
  currentPlanKey: BillingPlanKey
  isPaid: boolean
  locale: string
  currency: CommercialCurrency
  monthlyLabel: string
  yearlyLabel: string
  cadenceMonthlyLabel: string
  cadenceYearlyLabel: string
  equivalentMonthlyLabel: string
  oneTimeLabel: string
  paidAddonsLabel: string
  planDetailsLabel: string
  plans: PlanView[]
  popularLabel: string
  tenantId: string
}) {
  const [selectedPlanKey, setSelectedPlanKey] = useState<BillingPlanKey>(currentPlanKey)
  const [billingCadence, setBillingCadence] = useState<BillingCadence>(currentCadence)
  const [selectedAddonKeys, setSelectedAddonKeys] = useState<Set<BillingAddonKey>>(new Set(currentAddonKeys))
  const [pending, setPending] = useState(false)
  const [portalPending, setPortalPending] = useState<'manage' | 'cancel' | null>(null)
  const [addonPending, setAddonPending] = useState<BillingAddonKey | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedPlan = plans.find((plan) => plan.key === selectedPlanKey) ?? plans[0]
  const selectedAddons = addons.filter((addon) => selectedAddonKeys.has(addon.key))
  const recurringAddons = selectedAddons.filter((addon) => addon.billingMode === 'recurring')
  const oneTimeAddons = selectedAddons.filter((addon) => addon.billingMode === 'one_time')
  const selectedPlanPrice = getPriceForCadence(selectedPlan, billingCadence)
  const recurringTotal = selectedPlanPrice + recurringAddons.reduce((total, addon) => total + getPriceForCadence(addon, billingCadence), 0)
  const oneTimeTotal = oneTimeAddons.reduce((total, addon) => total + (addon.oneTimePrice ?? 0), 0)
  const hasDisabledSelection = !isConfiguredForCadence(selectedPlan, billingCadence) || selectedAddons.some((addon) => (
    addon.disabledForPaid || !isConfiguredForCadence(addon, billingCadence)
  ))

  function toggleAddon(addonKey: BillingAddonKey) {
    const addon = addons.find((candidate) => candidate.key === addonKey)
    if (isPaid && addon?.billingMode === 'one_time') return
    setSelectedAddonKeys((current) => {
      const next = new Set(current)
      if (next.has(addonKey)) next.delete(addonKey)
      else next.add(addonKey)
      return next
    })
  }

  async function submit() {
    if (pending || hasDisabledSelection || !canManageBilling) return
    setPending(true)
    setErrorMessage(null)
    const endpoint = isPaid ? '/api/billing/update-subscription' : '/api/billing/checkout'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          planKey: selectedPlanKey,
          addonKeys: Array.from(selectedAddonKeys),
          billingCadence,
        }),
      })
      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok) throw new Error(payload.error ?? checkoutLabels.error)
      if (payload.url) {
        window.location.assign(payload.url)
        return
      }
      window.location.reload()
    } catch (error) {
      console.error('[billing-configurator]', error)
      setPending(false)
      setErrorMessage(error instanceof Error ? error.message : checkoutLabels.error)
    }
  }

  async function purchaseAddon(addonKey: BillingAddonKey) {
    if (addonPending || !canManageBilling) return
    setAddonPending(addonKey)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/billing/addon-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, addonKey }),
      })
      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) throw new Error(payload.error ?? checkoutLabels.error)
      window.location.assign(payload.url)
    } catch (error) {
      console.error('[billing-addon-checkout]', error)
      setAddonPending(null)
      setErrorMessage(error instanceof Error ? error.message : checkoutLabels.error)
    }
  }

  async function openBillingPortal(flow: 'manage' | 'cancel') {
    if (portalPending || !canManageBilling) return
    setPortalPending(flow)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/billing/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, flow }),
      })
      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) throw new Error(payload.error ?? billingLabels.error)
      window.location.assign(payload.url)
    } catch (error) {
      console.error('[billing-customer-portal]', error)
      setPortalPending(null)
      setErrorMessage(error instanceof Error ? error.message : billingLabels.error)
    }
  }

  return (
    <section className="billing-configurator">
      <div className="billing-cadence-selector" role="group" aria-label={planDetailsLabel}>
        <button className={billingCadence === 'monthly' ? 'button-primary' : 'button-outline'} type="button" onClick={() => setBillingCadence('monthly')}>
          {cadenceMonthlyLabel}
        </button>
        <button className={billingCadence === 'yearly' ? 'button-primary' : 'button-outline'} type="button" onClick={() => setBillingCadence('yearly')}>
          {cadenceYearlyLabel}
        </button>
      </div>
      <div className="pricing-grid" aria-label="Planes">
        {plans.map((plan) => (
          <button
            key={plan.key}
            className={selectedPlanKey === plan.key ? 'pricing-card pricing-card-featured pricing-card-button' : 'pricing-card pricing-card-button'}
            type="button"
            onClick={() => setSelectedPlanKey(plan.key)}
          >
            {plan.highlighted ? <span className="pricing-badge">{popularLabel}</span> : null}
            <h2>{plan.title}</h2>
            <div className="pricing-price">
              <strong>{formatMoney(getPriceForCadence(plan, billingCadence), currency, locale)}</strong>
              <span>{billingCadence === 'yearly' ? yearlyLabel : monthlyLabel}</span>
            </div>
            {billingCadence === 'yearly' && plan.yearlyPrice ? (
              <small>{equivalentMonthlyLabel.replace('{price}', formatMoney(plan.yearlyPrice / 12, currency, locale))}</small>
            ) : null}
            <p className="pricing-included">{plan.includedLabel}</p>
            <ul className="pricing-feature-list">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="pricing-addons">
        {addons.map((addon) => {
          const isSelected = selectedAddonKeys.has(addon.key)
          const disabled = addon.disabledForPaid || !isConfiguredForCadence(addon, billingCadence)

          if (isPaid && addon.billingMode === 'one_time') {
            return (
              <div key={addon.key} className={disabled ? 'pricing-addon pricing-addon-disabled' : 'pricing-addon'}>
                <span className="pricing-addon-copy">
                  <strong>{addon.title}</strong>
                  <span>{addon.description}</span>
                </span>
                <b>{addon.oneTimePrice ? `${formatMoney(addon.oneTimePrice, currency, locale)} ${oneTimeLabel}` : ''}</b>
                <button className="button-outline" type="button" disabled={disabled || Boolean(addonPending) || !canManageBilling} onClick={() => purchaseAddon(addon.key)}>
                  {addonPending === addon.key ? checkoutLabels.pending : checkoutLabels.buy}
                </button>
              </div>
            )
          }

          return (
            <label
              key={addon.key}
              className={[
                'pricing-addon',
                'pricing-addon-selectable',
                isSelected ? 'pricing-addon-selected' : '',
                disabled ? 'pricing-addon-disabled' : '',
              ].filter(Boolean).join(' ')}
            >
              <input
                checked={isSelected}
                disabled={disabled}
                type="checkbox"
                onChange={() => toggleAddon(addon.key)}
              />
              <span className="pricing-addon-copy">
                <strong>{addon.title}</strong>
                <span>{addon.description}</span>
              </span>
              <b>{getAddonPriceLabel(addon, billingCadence, currency, locale, monthlyLabel, yearlyLabel, oneTimeLabel)}</b>
            </label>
          )
        })}
      </div>

      <aside className="billing-summary-card">
        <p className="eyebrow">{planDetailsLabel}</p>
        <h2>{selectedPlan.title}</h2>
        <div className="billing-summary-row">
          <span>{selectedPlan.includedLabel}</span>
          <strong>{formatMoney(selectedPlanPrice, currency, locale)}</strong>
        </div>
        <div className="billing-summary-addons">
          <div className="billing-summary-row">
            <span>{paidAddonsLabel}</span>
            <strong>{formatMoney(recurringAddons.reduce((total, addon) => total + getPriceForCadence(addon, billingCadence), 0), currency, locale)}</strong>
          </div>
          {recurringAddons.map((addon) => (
            <div key={addon.key} className="billing-summary-row billing-summary-row-muted">
              <span>{addon.title}</span>
              <strong>{formatMoney(getPriceForCadence(addon, billingCadence), currency, locale)}</strong>
            </div>
          ))}
          {oneTimeAddons.length > 0 ? (
            <>
              <div className="billing-summary-row">
                <span>{oneTimeLabel}</span>
                <strong>{formatMoney(oneTimeTotal, currency, locale)}</strong>
              </div>
              {oneTimeAddons.map((addon) => (
                <div key={addon.key} className="billing-summary-row billing-summary-row-muted">
                  <span>{addon.title}</span>
                  <strong>{addon.oneTimePrice ? formatMoney(addon.oneTimePrice, currency, locale) : ''}</strong>
                </div>
              ))}
            </>
          ) : null}
        </div>
        <div className="billing-summary-total">
          <strong>{formatMoney(recurringTotal, currency, locale)}</strong>
          <span>{billingCadence === 'yearly' ? yearlyLabel : monthlyLabel}</span>
        </div>
        <button className="button-primary pricing-action" type="button" disabled={pending || hasDisabledSelection || !canManageBilling} onClick={submit}>
          {!canManageBilling
            ? checkoutLabels.ownerOnly
            : pending
              ? checkoutLabels.pending
              : hasDisabledSelection
                ? checkoutLabels.disabled
                : checkoutLabels.idle}
        </button>

        {isPaid ? (
          <div className="billing-management">
            <div className="billing-management-copy">
              <strong>{billingLabels.title}</strong>
              <p>{billingLabels.description}</p>
              {cancellationScheduled ? (
                <p className="billing-cancellation-status" role="status">
                  {cancellationAt
                    ? <DateTemplate template={billingLabels.scheduled} value={cancellationAt} locale={locale} />
                    : billingLabels.scheduledWithoutDate}
                </p>
              ) : null}
              {!canManageBilling ? <p className="muted">{billingLabels.ownerOnly}</p> : null}
            </div>
            <div className="billing-management-actions">
              <button
                className="button-outline"
                type="button"
                disabled={Boolean(portalPending) || !canManageBilling}
                onClick={() => openBillingPortal('manage')}
              >
                {portalPending === 'manage' ? billingLabels.opening : billingLabels.manage}
              </button>
              {!cancellationScheduled ? (
                <button
                  className="button-outline button-danger"
                  type="button"
                  disabled={Boolean(portalPending) || !canManageBilling}
                  onClick={() => openBillingPortal('cancel')}
                >
                  {portalPending === 'cancel' ? billingLabels.opening : billingLabels.cancel}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {errorMessage ? <p className="billing-error" role="alert">{errorMessage}</p> : null}
      </aside>
    </section>
  )
}

function getAddonPriceLabel(
  addon: AddonView,
  cadence: BillingCadence,
  currency: CommercialCurrency,
  locale: string,
  monthlyLabel: string,
  yearlyLabel: string,
  oneTimeLabel: string,
) {
  if (addon.billingMode === 'one_time') {
    return addon.oneTimePrice ? `${formatMoney(addon.oneTimePrice, currency, locale)} ${oneTimeLabel}` : ''
  }

  const amount = getPriceForCadence(addon, cadence)
  return amount > 0 ? `${formatMoney(amount, currency, locale)} ${cadence === 'yearly' ? yearlyLabel : monthlyLabel}` : ''
}

function getPriceForCadence(item: PlanView | AddonView, cadence: BillingCadence) {
  return cadence === 'yearly' ? item.yearlyPrice ?? 0 : item.monthlyPrice ?? 0
}

function isConfiguredForCadence(item: PlanView | AddonView, cadence: BillingCadence) {
  if ('billingMode' in item && item.billingMode === 'one_time') return Boolean(item.oneTimePrice && item.monthlyConfigured)
  return cadence === 'yearly' ? item.yearlyConfigured : item.monthlyConfigured
}

function formatMoney(amount: number, currency: CommercialCurrency, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function DateTemplate({ template, value, locale }: { template: string; value: string; locale: string }) {
  const [before, after = ''] = template.split('{date}', 2)
  return <>{before}<LocalDateTime value={value} locale={locale} dateOnly />{after}</>
}
