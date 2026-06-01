'use client'

import type { BillingPlanKey } from '@/lib/billing/plans'
import { useState } from 'react'

export function PlanCheckoutButton({
  disabled,
  labels,
  planKey,
  tenantId,
}: {
  disabled: boolean
  labels: {
    idle: string
    pending: string
    disabled: string
    error: string
  }
  planKey: BillingPlanKey
  tenantId: string
}) {
  const [pending, setPending] = useState(false)

  async function startCheckout() {
    if (disabled || pending) return
    setPending(true)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, planKey }),
      })
      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? labels.error)
      }

      window.location.assign(payload.url)
    } catch (error) {
      console.error('[billing-checkout]', error)
      setPending(false)
      window.alert(error instanceof Error ? error.message : labels.error)
    }
  }

  return (
    <button className="button-primary pricing-action" type="button" disabled={disabled || pending} onClick={startCheckout}>
      {pending ? labels.pending : disabled ? labels.disabled : labels.idle}
    </button>
  )
}
