'use client'

import type { MarketingCopy } from '@/lib/i18n/marketing-copy'
import type { MetaMarketingEligibleTrafficCampaign } from '@/types/marketing'
import { useActionState } from 'react'
import {
  createMetaMarketingAdSetAction,
  type MetaMarketingAdSetCreateActionState,
} from './ad-set-create-actions'

export function MarketingAdSetCreateForm({
  adsManagerUrl,
  campaigns,
  canCreate,
  copy,
  currency,
  initialRequestId,
  tenantId,
}: {
  adsManagerUrl: string
  campaigns: MetaMarketingEligibleTrafficCampaign[]
  canCreate: boolean
  copy: MarketingCopy
  currency: string | null
  initialRequestId: string
  tenantId: string
}) {
  const action = createMetaMarketingAdSetAction.bind(null, tenantId)
  const [state, formAction, pending] = useActionState<
    MetaMarketingAdSetCreateActionState,
    FormData
  >(action, null)
  const available = canCreate && currency !== null && campaigns.length > 0
  const budgetStep = getCurrencyStep(currency)

  return (
    <section className="card stack marketing-create-card">
      <div className="section-title-row marketing-create-heading">
        <div>
          <p className="section-label">{copy.adSetEyebrow}</p>
          <h2>{copy.adSetTitle}</h2>
          <p className="muted">{copy.adSetDescription}</p>
        </div>
        <span className="status-pill status-pill-soon">PAUSED</span>
      </div>

      {!canCreate || currency === null ? (
        <div className="notice notice-warning" role="status">
          <strong>{copy.adSetLockedTitle}</strong>{' '}{copy.adSetLockedDescription}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="notice notice-info" role="status">
          <strong>{copy.adSetNoCampaignTitle}</strong>{' '}{copy.adSetNoCampaignDescription}
        </div>
      ) : (
        <form
          action={formAction}
          className="marketing-ad-set-form"
          onSubmit={(event) => {
            const form = event.currentTarget
            const requestId = form.elements.namedItem('requestId')
            if (state?.ok === false && requestId instanceof HTMLInputElement) {
              requestId.value = crypto.randomUUID()
            }

            const startLocal = form.elements.namedItem('startLocal')
            const endLocal = form.elements.namedItem('endLocal')
            const startTime = form.elements.namedItem('startTime')
            const endTime = form.elements.namedItem('endTime')
            if (
              startLocal instanceof HTMLInputElement
              && endLocal instanceof HTMLInputElement
              && startTime instanceof HTMLInputElement
              && endTime instanceof HTMLInputElement
            ) {
              startTime.value = new Date(startLocal.value).toISOString()
              endTime.value = new Date(endLocal.value).toISOString()
            }
          }}
        >
          <input name="requestId" type="hidden" defaultValue={initialRequestId} />
          <input name="startTime" type="hidden" />
          <input name="endTime" type="hidden" />

          <label className="field marketing-ad-set-wide">
            <span>{copy.adSetCampaign}</span>
            <select name="providerCampaignId" required>
              {campaigns.map((campaign) => (
                <option key={campaign.campaign_id} value={campaign.campaign_id}>
                  {campaign.name} · {campaign.configured_status}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{copy.adSetName}</span>
            <input
              autoComplete="off"
              maxLength={200}
              name="name"
              placeholder={copy.adSetNamePlaceholder}
              required
              type="text"
            />
          </label>
          <label className="field">
            <span>{copy.adSetDailyBudget} · {currency}</span>
            <input
              inputMode="decimal"
              min={budgetStep}
              name="dailyBudget"
              placeholder="20.00"
              required
              step={budgetStep}
              type="number"
            />
          </label>
          <label className="field">
            <span>{copy.adSetStart}</span>
            <input name="startLocal" required type="datetime-local" />
          </label>
          <label className="field">
            <span>{copy.adSetEnd}</span>
            <input name="endLocal" required type="datetime-local" />
          </label>
          <label className="field marketing-ad-set-wide">
            <span>{copy.adSetCountries}</span>
            <input
              autoComplete="off"
              maxLength={100}
              name="countries"
              placeholder={copy.adSetCountriesPlaceholder}
              required
              type="text"
            />
            <small>{copy.adSetCountriesHelp}</small>
          </label>
          <label className="field">
            <span>{copy.adSetAgeMin}</span>
            <input defaultValue="18" max="65" min="18" name="ageMin" required type="number" />
          </label>
          <label className="field">
            <span>{copy.adSetAgeMax}</span>
            <input defaultValue="65" max="65" min="18" name="ageMax" required type="number" />
          </label>
          <div className="marketing-create-actions marketing-ad-set-wide">
            <button
              className="button-primary button-fit"
              disabled={pending || state?.ok === true || !available}
              type="submit"
            >
              {pending ? copy.adSetCreating : copy.adSetCreate}
            </button>
            <span className="muted">{copy.adSetGuardrail}</span>
          </div>
        </form>
      )}

      {state?.ok === true ? (
        <div className="notice notice-success marketing-create-result" role="status">
          <span>{copy.adSetSuccess}</span>
          <a href={adsManagerUrl} rel="noreferrer" target="_blank">
            {copy.viewAdsManager}
          </a>
        </div>
      ) : null}
      {state?.ok === false ? (
        <p className="notice notice-error" role="alert">
          {getCreateError(copy, state.code)}
        </p>
      ) : null}
    </section>
  )
}

function getCurrencyStep(currency: string | null) {
  if (!currency) return '0.01'
  try {
    const digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
    return digits === 0 ? '1' : `0.${'0'.repeat(digits - 1)}1`
  } catch {
    return '0.01'
  }
}

function getCreateError(
  copy: MarketingCopy,
  code: Exclude<MetaMarketingAdSetCreateActionState, null | { ok: true }>['code'],
) {
  if (code === 'invalid') return copy.adSetInvalid
  if (code === 'connection') return copy.adSetConnectionError
  if (code === 'in_progress') return copy.adSetInProgress
  if (code === 'provider') return copy.adSetProviderError
  return copy.adSetSaveError
}
