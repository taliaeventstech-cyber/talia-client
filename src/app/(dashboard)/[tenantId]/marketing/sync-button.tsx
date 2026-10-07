'use client'

import type { MarketingCopy } from '@/lib/i18n/marketing-copy'
import type { MetaMarketingPeriod } from '@/types/marketing'
import { useActionState } from 'react'
import {
  syncMetaMarketingAction,
  type MetaMarketingSyncActionState,
} from './sync-actions'

export function MetaMarketingSyncButton({
  tenantId,
  period,
  copy,
}: {
  tenantId: string
  period: MetaMarketingPeriod
  copy: MarketingCopy
}) {
  const action = syncMetaMarketingAction.bind(null, tenantId, period)
  const [state, formAction, pending] = useActionState<MetaMarketingSyncActionState, FormData>(
    action,
    null,
  )

  return (
    <form action={formAction} className="marketing-sync-control">
      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? copy.syncing : copy.syncNow}
      </button>
      {state?.ok === true ? (
        <span className="marketing-sync-feedback" role="status">{copy.syncComplete}</span>
      ) : null}
      {state?.ok === false ? (
        <span className="marketing-sync-feedback marketing-sync-feedback-error" role="alert">
          {getSyncError(copy, state.code)}
        </span>
      ) : null}
    </form>
  )
}

function getSyncError(
  copy: MarketingCopy,
  code: Exclude<MetaMarketingSyncActionState, null | { ok: true }>['code'],
) {
  if (code === 'reauthorize' || code === 'connection') return copy.syncReconnect
  if (code === 'provider') return copy.syncProviderError
  return copy.syncSaveError
}
