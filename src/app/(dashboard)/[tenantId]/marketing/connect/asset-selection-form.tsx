'use client'

import type { MarketingCopy } from '@/lib/i18n/marketing-copy'
import type { MetaMarketingBusiness } from '@/lib/marketing/oauth'
import { useActionState, useMemo, useState } from 'react'
import {
  completeMetaMarketingConnectionAction,
  type MetaMarketingSelectionActionState,
} from './actions'

export function MarketingAssetSelectionForm({
  businesses,
  copy,
  tenantId,
}: {
  businesses: MetaMarketingBusiness[]
  copy: MarketingCopy
  tenantId: string
}) {
  const initialBusiness = businesses.find((business) => business.adAccounts.length > 0)
  const [businessId, setBusinessId] = useState(initialBusiness?.id ?? businesses[0]?.id ?? '')
  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === businessId) ?? null,
    [businessId, businesses],
  )
  const action = completeMetaMarketingConnectionAction.bind(null, tenantId)
  const [state, formAction, pending] = useActionState<
    MetaMarketingSelectionActionState,
    FormData
  >(action, null)

  return (
    <form action={formAction} className="card stack marketing-asset-selection-form">
      <div>
        <p className="section-label">Meta</p>
        <h1>{copy.selectAssetsTitle}</h1>
        <p className="muted">{copy.selectAssetsDescription}</p>
      </div>

      <label className="field">
        <span>{copy.business}</span>
        <select
          name="businessId"
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
          required
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>{business.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{copy.adAccount}</span>
        <select name="adAccountId" key={selectedBusiness?.id} required>
          {(selectedBusiness?.adAccounts ?? []).map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}{account.currency ? ` · ${account.currency}` : ''}
            </option>
          ))}
        </select>
      </label>

      {selectedBusiness && selectedBusiness.adAccounts.length === 0 ? (
        <p className="notice notice-warning" role="status">{copy.noAdAccounts}</p>
      ) : null}
      {state ? (
        <p className="notice notice-error" role="alert">
          {getSelectionError(copy, state.code)}
        </p>
      ) : null}

      <p className="notice notice-info">{copy.guardrail}</p>
      <button
        className="button-primary button-fit"
        type="submit"
        disabled={pending || !selectedBusiness || selectedBusiness.adAccounts.length === 0}
      >
        {pending ? copy.connecting : copy.confirmAssets}
      </button>
    </form>
  )
}

function getSelectionError(copy: MarketingCopy, code: NonNullable<MetaMarketingSelectionActionState>['code']) {
  if (code === 'session') return copy.sessionExpired
  if (code === 'asset') return copy.assetUnavailable
  if (code === 'provider') return copy.providerUnavailable
  return copy.connectionFailed
}
