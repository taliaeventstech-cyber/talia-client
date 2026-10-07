import type { createAdminClient } from '@/lib/supabase/admin'
import type { MetaMarketingPeriod } from '@/types/marketing'
import {
  getMetaMarketingSyncContext,
  recordMetaMarketingSyncFailure,
  replaceMetaMarketingCampaignSnapshot,
  type MetaMarketingSyncContext,
} from './connection-service'
import { parseMetaMarketingCredentialMetadata } from './credentials'
import {
  fetchMetaMarketingSnapshot,
  MetaMarketingInsightsError,
  type MetaMarketingProviderSnapshot,
} from './insights-service'

type AdminClient = ReturnType<typeof createAdminClient>

export class MetaMarketingSyncError extends Error {
  constructor(
    public readonly code: string,
    public readonly kind: 'connection' | 'reauthorize' | 'provider' | 'save',
  ) {
    super(code)
    this.name = 'MetaMarketingSyncError'
  }
}

export async function syncMetaMarketingSnapshot(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    period?: MetaMarketingPeriod
  },
  options: { fetcher?: typeof fetch; now?: number } = {},
): Promise<MetaMarketingProviderSnapshot> {
  let context: MetaMarketingSyncContext | null = null
  try {
    context = await getMetaMarketingSyncContext(admin, input)
    if (!context) {
      throw new MetaMarketingSyncError(
        'meta_marketing_sync_connection_missing',
        'connection',
      )
    }

    const credentials = parseMetaMarketingCredentialMetadata(context.credential_metadata)
    if (Date.parse(credentials.expiresAt) <= (options.now ?? Date.now())) {
      throw new MetaMarketingSyncError('meta_marketing_sync_token_expired', 'reauthorize')
    }

    const snapshot = await fetchMetaMarketingSnapshot(
      context.ad_account_id,
      credentials.accessToken,
      {
        fetcher: options.fetcher,
        period: input.period ?? 'last_30d',
      },
    )
    await replaceMetaMarketingCampaignSnapshot(admin, {
      ...input,
      connectionId: context.connection_id,
      period: snapshot.period,
      summary: snapshot.summary,
      campaigns: snapshot.campaigns,
      dailyInsights: snapshot.daily_insights,
    })
    return snapshot
  } catch (error) {
    const normalized = normalizeSyncError(error)
    if (context) {
      try {
        await recordMetaMarketingSyncFailure(admin, {
          ...input,
          connectionId: context.connection_id,
          period: input.period ?? 'last_30d',
          errorCode: normalized.code,
        })
      } catch {
        // The original sync error remains the actionable result.
      }
    }
    throw normalized
  }
}

function normalizeSyncError(error: unknown) {
  if (error instanceof MetaMarketingSyncError) return error
  if (error instanceof MetaMarketingInsightsError) {
    if (error.status === 401 || error.status === 403) {
      return new MetaMarketingSyncError(error.code, 'reauthorize')
    }
    return new MetaMarketingSyncError(error.code, 'provider')
  }
  if (
    error instanceof Error
    && /^meta_marketing_(snapshot|dashboard|sync_context|encryption|connection)/.test(error.message)
  ) {
    return new MetaMarketingSyncError(error.message, 'save')
  }
  return new MetaMarketingSyncError('meta_marketing_sync_failed', 'save')
}
