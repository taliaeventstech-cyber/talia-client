'use client'

import type { BillingAddonKey, BillingPlanKey } from '@/lib/billing/plans'
import { Check } from 'lucide-react'
import { useState } from 'react'

type PlanView = {
  key: BillingPlanKey
  title: string
  priceMonthly: number
  includedLabel: string
  features: readonly string[]
  highlighted?: boolean
  disabled: boolean
}

type AddonView = {
  key: BillingAddonKey
  title: string
  priceMonthly: number
  priceOneTime?: number
  description: string
  billingMode: 'recurring' | 'one_time'
  disabled: boolean
}

export function BillingConfigurator({
  addons,
  checkoutLabels,
  currentAddonKeys,
  currentPlanKey,
  isPaid,
  monthlyLabel,
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
  }
  currentAddonKeys: BillingAddonKey[]
  currentPlanKey: BillingPlanKey
  isPaid: boolean
  monthlyLabel: string
  oneTimeLabel: string
  paidAddonsLabel: string
  planDetailsLabel: string
  plans: PlanView[]
  popularLabel: string
  tenantId: string
}) {
  const [selectedPlanKey, setSelectedPlanKey] = useState<BillingPlanKey>(currentPlanKey)
  const [selectedAddonKeys, setSelectedAddonKeys] = useState<Set<BillingAddonKey>>(new Set(currentAddonKeys))
  const [pending, setPending] = useState(false)
  const selectedPlan = plans.find((plan) => plan.key === selectedPlanKey) ?? plans[0]
  const selectedAddons = addons.filter((addon) => selectedAddonKeys.has(addon.key))
  const recurringAddons = selectedAddons.filter((addon) => addon.billingMode === 'recurring')
  const oneTimeAddons = selectedAddons.filter((addon) => addon.billingMode === 'one_time')
  const monthlyTotal = selectedPlan.priceMonthly + recurringAddons.reduce((total, addon) => total + addon.priceMonthly, 0)
  const oneTimeTotal = oneTimeAddons.reduce((total, addon) => total + (addon.priceOneTime ?? 0), 0)
  const hasDisabledSelection = selectedPlan.disabled || selectedAddons.some((addon) => addon.disabled)

  function toggleAddon(addonKey: BillingAddonKey) {
    setSelectedAddonKeys((current) => {
      const next = new Set(current)
      if (next.has(addonKey)) next.delete(addonKey)
      else next.add(addonKey)
      return next
    })
  }

  async function submit() {
    if (pending || hasDisabledSelection) return
    setPending(true)
    const endpoint = isPaid ? '/api/billing/update-subscription' : '/api/billing/checkout'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          planKey: selectedPlanKey,
          addonKeys: Array.from(selectedAddonKeys),
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
      window.alert(error instanceof Error ? error.message : checkoutLabels.error)
    }
  }

  return (
    <section className="billing-configurator">
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
              <strong>{plan.priceMonthly}€</strong>
              <span>{monthlyLabel}</span>
            </div>
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
        {addons.map((addon) => (
          <label key={addon.key} className="pricing-addon pricing-addon-selectable">
            <div>
              <strong>{addon.title}</strong>
              <span>{addon.description}</span>
            </div>
            <b>{getAddonPriceLabel(addon, monthlyLabel, oneTimeLabel)}</b>
            <input
              checked={selectedAddonKeys.has(addon.key)}
              disabled={addon.disabled}
              type="checkbox"
              onChange={() => toggleAddon(addon.key)}
            />
          </label>
        ))}
      </div>

      <aside className="billing-summary-card">
        <p className="eyebrow">{planDetailsLabel}</p>
        <h2>{selectedPlan.title}</h2>
        <div className="billing-summary-row">
          <span>{selectedPlan.includedLabel}</span>
          <strong>{selectedPlan.priceMonthly}€</strong>
        </div>
        <div className="billing-summary-addons">
          <div className="billing-summary-row">
            <span>{paidAddonsLabel}</span>
            <strong>{recurringAddons.reduce((total, addon) => total + addon.priceMonthly, 0)}€</strong>
          </div>
          {recurringAddons.map((addon) => (
            <div key={addon.key} className="billing-summary-row billing-summary-row-muted">
              <span>{addon.title}</span>
              <strong>{addon.priceMonthly > 0 ? `${addon.priceMonthly}€` : ''}</strong>
            </div>
          ))}
          {oneTimeAddons.length > 0 ? (
            <>
              <div className="billing-summary-row">
                <span>{oneTimeLabel}</span>
                <strong>{oneTimeTotal}€</strong>
              </div>
              {oneTimeAddons.map((addon) => (
                <div key={addon.key} className="billing-summary-row billing-summary-row-muted">
                  <span>{addon.title}</span>
                  <strong>{addon.priceOneTime ? `${addon.priceOneTime}€` : ''}</strong>
                </div>
              ))}
            </>
          ) : null}
        </div>
        <div className="billing-summary-total">
          <strong>{monthlyTotal}€</strong>
          <span>{monthlyLabel}</span>
        </div>
        <button className="button-primary pricing-action" type="button" disabled={pending || hasDisabledSelection} onClick={submit}>
          {pending ? checkoutLabels.pending : hasDisabledSelection ? checkoutLabels.disabled : checkoutLabels.idle}
        </button>
      </aside>
    </section>
  )
}

function getAddonPriceLabel(addon: AddonView, monthlyLabel: string, oneTimeLabel: string) {
  if (addon.billingMode === 'one_time') {
    return addon.priceOneTime ? `${addon.priceOneTime}€ ${oneTimeLabel}` : ''
  }

  return addon.priceMonthly > 0 ? `${addon.priceMonthly}€ ${monthlyLabel}` : ''
}
