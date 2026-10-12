'use client'

import type { MarketingCopy } from '@/lib/i18n/marketing-copy'
import { useActionState } from 'react'
import {
  createMetaMarketingCampaignAction,
  type MetaMarketingCampaignCreateActionState,
} from './campaign-create-actions'

export function MarketingCampaignCreateForm({
  adsManagerUrl,
  canCreate,
  copy,
  initialRequestId,
  tenantId,
}: {
  adsManagerUrl: string
  canCreate: boolean
  copy: MarketingCopy
  initialRequestId: string
  tenantId: string
}) {
  const action = createMetaMarketingCampaignAction.bind(null, tenantId)
  const [state, formAction, pending] = useActionState<
    MetaMarketingCampaignCreateActionState,
    FormData
  >(action, null)

  return (
    <section className="card stack marketing-create-card">
      <div className="section-title-row marketing-create-heading">
        <div>
          <p className="section-label">{copy.createEyebrow}</p>
          <h2>{copy.createTitle}</h2>
          <p className="muted">{copy.createDescription}</p>
        </div>
        <span className="status-pill status-pill-soon">PAUSED</span>
      </div>

      {!canCreate ? (
        <div className="notice notice-warning" role="status">
          <strong>{copy.createLockedTitle}</strong>{' '}{copy.createLockedDescription}
        </div>
      ) : (
        <form
          action={formAction}
          className="marketing-create-form"
          onSubmit={(event) => {
            if (state?.ok !== false) return
            const input = event.currentTarget.elements.namedItem('requestId')
            if (input instanceof HTMLInputElement) input.value = crypto.randomUUID()
          }}
        >
          <input name="requestId" type="hidden" defaultValue={initialRequestId} />
          <label className="field">
            <span>{copy.campaignName}</span>
            <input
              autoComplete="off"
              maxLength={200}
              name="name"
              placeholder={copy.campaignNamePlaceholder}
              required
              type="text"
            />
          </label>
          <label className="field">
            <span>{copy.campaignObjective}</span>
            <select defaultValue="OUTCOME_TRAFFIC" name="objective">
              <option value="OUTCOME_TRAFFIC">{copy.objectiveTraffic}</option>
              <option value="OUTCOME_ENGAGEMENT">{copy.objectiveEngagement}</option>
              <option value="OUTCOME_AWARENESS">{copy.objectiveAwareness}</option>
            </select>
          </label>
          <label className="marketing-create-confirmation">
            <input name="noSpecialAdCategoryConfirmed" required type="checkbox" />
            <span>
              <strong>{copy.noSpecialCategoryLabel}</strong>
              <small>{copy.noSpecialCategoryHelp}</small>
            </span>
          </label>
          <div className="marketing-create-actions">
            <button
              className="button-primary button-fit"
              disabled={pending || state?.ok === true}
              type="submit"
            >
              {pending ? copy.creatingCampaign : copy.createCampaign}
            </button>
            <span className="muted">{copy.createGuardrail}</span>
          </div>
        </form>
      )}

      {state?.ok === true ? (
        <div className="notice notice-success marketing-create-result" role="status">
          <span>{copy.createSuccess}</span>
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

function getCreateError(
  copy: MarketingCopy,
  code: Exclude<MetaMarketingCampaignCreateActionState, null | { ok: true }>['code'],
) {
  if (code === 'invalid') return copy.createInvalid
  if (code === 'connection') return copy.createConnectionError
  if (code === 'in_progress') return copy.createInProgress
  if (code === 'provider') return copy.createProviderError
  return copy.createSaveError
}
