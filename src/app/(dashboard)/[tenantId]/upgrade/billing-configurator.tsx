'use client'

import type { BillingPlanKey } from '@/lib/billing/plans'
import { LocalDateTime } from '@/components/local-date-time'
import { Check } from 'lucide-react'
import { useState } from 'react'

type PlanView = {
  key: BillingPlanKey
  title: string
  includedLabel: string
  features: readonly string[]
  highlighted?: boolean
  monthlyConfigured: boolean
  priceLabel: string
}

export function BillingConfigurator({
  billingLabels,
  cancellationAt,
  cancellationScheduled,
  canManageBilling,
  checkoutLabels,
  currentPlanKey,
  isPaid,
  locale,
  monthlyLabel,
  planDetailsLabel,
  plans,
  popularLabel,
  pricePendingLabel,
  tenantId,
}: {
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
  checkoutLabels: {
    idle: string
    pending: string
    disabled: string
    error: string
    ownerOnly: string
  }
  currentPlanKey: BillingPlanKey
  isPaid: boolean
  locale: string
  monthlyLabel: string
  planDetailsLabel: string
  plans: PlanView[]
  popularLabel: string
  pricePendingLabel: string
  tenantId: string
}) {
  const [selectedPlanKey, setSelectedPlanKey] = useState<BillingPlanKey>(currentPlanKey)
  const [pending, setPending] = useState(false)
  const [portalPending, setPortalPending] = useState<'manage' | 'cancel' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedPlan = plans.find((plan) => plan.key === selectedPlanKey) ?? plans[0]
  const hasDisabledSelection = !selectedPlan?.monthlyConfigured

  async function submit() {
    if (pending || hasDisabledSelection || !canManageBilling || !selectedPlan) return
    setPending(true)
    setErrorMessage(null)
    const endpoint = isPaid ? '/api/billing/update-subscription' : '/api/billing/checkout'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, planKey: selectedPlan.key, addonKeys: [], billingCadence: 'monthly' }),
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
      <div className="pricing-grid" aria-label="Planes">
        {plans.map((plan) => (
          <button
            key={plan.key}
            className={[
              'pricing-card',
              'pricing-card-button',
              plan.highlighted ? 'pricing-card-featured' : '',
              selectedPlanKey === plan.key ? 'pricing-card-selected' : '',
            ].filter(Boolean).join(' ')}
            type="button"
            onClick={() => setSelectedPlanKey(plan.key)}
            aria-pressed={selectedPlanKey === plan.key}
          >
            {plan.highlighted ? <span className="pricing-badge">{popularLabel}</span> : null}
            <h2>{plan.title}</h2>
            <p className="pricing-price">
              <strong>{plan.priceLabel}</strong>
              {plan.priceLabel !== pricePendingLabel ? <span>{monthlyLabel}</span> : null}
            </p>
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

      {selectedPlan ? (
        <aside className="billing-summary-card">
          <p className="eyebrow">{planDetailsLabel}</p>
          <h2>{selectedPlan.title}</h2>
          <div className="billing-summary-row">
            <span>{selectedPlan.includedLabel}</span>
            <strong>{selectedPlan.priceLabel}{selectedPlan.priceLabel !== pricePendingLabel ? ` ${monthlyLabel}` : ''}</strong>
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
                <button className="button-outline" type="button" disabled={Boolean(portalPending) || !canManageBilling} onClick={() => openBillingPortal('manage')}>
                  {portalPending === 'manage' ? billingLabels.opening : billingLabels.manage}
                </button>
                {!cancellationScheduled ? (
                  <button className="button-outline button-danger" type="button" disabled={Boolean(portalPending) || !canManageBilling} onClick={() => openBillingPortal('cancel')}>
                    {portalPending === 'cancel' ? billingLabels.opening : billingLabels.cancel}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {errorMessage ? <p className="billing-error" role="alert">{errorMessage}</p> : null}
        </aside>
      ) : null}
    </section>
  )
}

function DateTemplate({ template, value, locale }: { template: string; value: string; locale: string }) {
  const [before, after = ''] = template.split('{date}', 2)
  return <>{before}<LocalDateTime value={value} locale={locale} dateOnly />{after}</>
}
