'use client'

import type { MarketingCopy } from '@/lib/i18n/marketing-copy'
import type {
  MetaMarketingEligibleTrafficAdSet,
  MetaMarketingPromotablePage,
} from '@/types/marketing'
import { useActionState } from 'react'
import {
  createMetaMarketingAdAction,
  type MetaMarketingAdCreateActionState,
} from './ad-create-actions'

export function MarketingAdCreateForm({
  adSets,
  adsManagerUrl,
  canCreate,
  copy,
  initialRequestId,
  pages,
  tenantId,
}: {
  adSets: MetaMarketingEligibleTrafficAdSet[]
  adsManagerUrl: string
  canCreate: boolean
  copy: MarketingCopy
  initialRequestId: string
  pages: MetaMarketingPromotablePage[]
  tenantId: string
}) {
  const action = createMetaMarketingAdAction.bind(null, tenantId)
  const [state, formAction, pending] = useActionState<
    MetaMarketingAdCreateActionState,
    FormData
  >(action, null)
  const available = canCreate && adSets.length > 0 && pages.length > 0

  return (
    <section className="card stack marketing-create-card">
      <div className="section-title-row marketing-create-heading">
        <div>
          <p className="section-label">{copy.adEyebrow}</p>
          <h2>{copy.adTitle}</h2>
          <p className="muted">{copy.adDescription}</p>
        </div>
        <span className="status-pill status-pill-soon">PAUSED</span>
      </div>

      {!canCreate ? (
        <div className="notice notice-warning" role="status">
          <strong>{copy.adLockedTitle}</strong>{' '}{copy.adLockedDescription}
        </div>
      ) : adSets.length === 0 ? (
        <div className="notice notice-info" role="status">
          <strong>{copy.adNoAdSetTitle}</strong>{' '}{copy.adNoAdSetDescription}
        </div>
      ) : pages.length === 0 ? (
        <div className="notice notice-warning" role="status">
          <strong>{copy.adNoPageTitle}</strong>{' '}{copy.adNoPageDescription}
        </div>
      ) : (
        <form
          action={formAction}
          className="marketing-ad-set-form"
          onSubmit={(event) => {
            const requestId = event.currentTarget.elements.namedItem('requestId')
            if (state?.ok === false && requestId instanceof HTMLInputElement) {
              requestId.value = crypto.randomUUID()
            }
          }}
        >
          <input name="requestId" type="hidden" defaultValue={initialRequestId} />

          <label className="field marketing-ad-set-wide">
            <span>{copy.adAdSet}</span>
            <select name="providerAdSetId" required>
              {adSets.map((adSet) => (
                <option key={adSet.ad_set_id} value={adSet.ad_set_id}>
                  {adSet.name} · {adSet.status}
                </option>
              ))}
            </select>
          </label>
          <label className="field marketing-ad-set-wide">
            <span>{copy.adPage}</span>
            <select name="pageId" required>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>{page.name}</option>
              ))}
            </select>
            <small>{copy.adPageHelp}</small>
          </label>
          <label className="field">
            <span>{copy.adName}</span>
            <input
              autoComplete="off"
              maxLength={200}
              name="name"
              placeholder={copy.adNamePlaceholder}
              required
              type="text"
            />
          </label>
          <label className="field">
            <span>{copy.adHeadline}</span>
            <input
              autoComplete="off"
              maxLength={200}
              name="headline"
              placeholder={copy.adHeadlinePlaceholder}
              required
              type="text"
            />
          </label>
          <label className="field marketing-ad-set-wide">
            <span>{copy.adPrimaryText}</span>
            <textarea
              maxLength={500}
              name="primaryText"
              placeholder={copy.adPrimaryTextPlaceholder}
              required
              rows={4}
            />
          </label>
          <label className="field marketing-ad-set-wide">
            <span>{copy.adDestinationUrl}</span>
            <input
              inputMode="url"
              maxLength={2048}
              name="destinationUrl"
              placeholder="https://example.org/tickets"
              required
              type="url"
            />
          </label>
          <label className="field marketing-ad-set-wide">
            <span>{copy.adImageUrl}</span>
            <input
              inputMode="url"
              maxLength={2048}
              name="imageUrl"
              placeholder="https://example.org/campaign.jpg"
              required
              type="url"
            />
            <small>{copy.adImageUrlHelp}</small>
          </label>
          <label className="field marketing-ad-set-wide">
            <span>{copy.adCallToAction}</span>
            <select defaultValue="LEARN_MORE" name="callToAction" required>
              <option value="LEARN_MORE">{copy.adCtaLearnMore}</option>
              <option value="BUY_TICKETS">{copy.adCtaBuyTickets}</option>
            </select>
          </label>
          <div className="marketing-create-actions marketing-ad-set-wide">
            <button
              className="button-primary button-fit"
              disabled={pending || state?.ok === true || !available}
              type="submit"
            >
              {pending ? copy.adCreating : copy.adCreate}
            </button>
            <span className="muted">{copy.adGuardrail}</span>
          </div>
        </form>
      )}

      {state?.ok === true ? (
        <div className="notice notice-success marketing-create-result" role="status">
          <span>{copy.adSuccess}</span>
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
  code: Exclude<MetaMarketingAdCreateActionState, null | { ok: true }>['code'],
) {
  if (code === 'invalid') return copy.adInvalid
  if (code === 'connection') return copy.adConnectionError
  if (code === 'in_progress') return copy.adInProgress
  if (code === 'provider') return copy.adProviderError
  return copy.adSaveError
}
