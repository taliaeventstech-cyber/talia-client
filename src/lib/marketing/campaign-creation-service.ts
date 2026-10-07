import type { createAdminClient } from '@/lib/supabase/admin'
import {
  metaMarketingCampaignObjectiveSchema,
  type MetaMarketingCampaignObjective,
} from '@/types/marketing'
import {
  claimMetaMarketingCampaignCreation,
  completeMetaMarketingCampaignCreation,
  failMetaMarketingCampaignCreation,
} from './connection-service'
import { parseMetaMarketingCredentialMetadata } from './credentials'
import { getMetaMarketingOAuthConfig } from './oauth'
import { z } from 'zod'

type AdminClient = ReturnType<typeof createAdminClient>

const providerResponseSchema = z.object({
  id: z.string().min(1).max(200),
})

export class MetaMarketingCampaignCreationError extends Error {
  constructor(
    public readonly code: string,
    public readonly kind: 'connection' | 'in_progress' | 'provider' | 'save',
  ) {
    super(code)
    this.name = 'MetaMarketingCampaignCreationError'
  }
}

export async function createPausedMetaMarketingCampaign(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    requestId: string
    name: string
    objective: MetaMarketingCampaignObjective
  },
  options: { fetcher?: typeof fetch; timeoutMs?: number; now?: number } = {},
) {
  const objective = metaMarketingCampaignObjectiveSchema.parse(input.objective)
  let claim

  try {
    claim = await claimMetaMarketingCampaignCreation(admin, { ...input, objective })
  } catch {
    throw new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_creation_unavailable',
      'connection',
    )
  }

  if (claim.outcome === 'succeeded') {
    return {
      providerCampaignId: claim.provider_campaign_id,
      deduplicated: true,
    }
  }
  if (claim.outcome === 'processing') {
    throw new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_creation_in_progress',
      'in_progress',
    )
  }
  if (claim.outcome === 'failed') {
    throw new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_creation_retry_with_new_request',
      'provider',
    )
  }

  let providerCreated = false
  try {
    const credentials = parseMetaMarketingCredentialMetadata(claim.credential_metadata)
    const now = options.now ?? Date.now()
    if (Date.parse(credentials.expiresAt) <= now) {
      throw new MetaMarketingCampaignCreationError(
        'meta_marketing_campaign_creation_token_expired',
        'connection',
      )
    }

    const created = await postPausedMetaMarketingCampaign(
      claim.ad_account_id,
      credentials.accessToken,
      { name: input.name, objective },
      options,
    )
    providerCreated = true

    await completeMetaMarketingCampaignCreation(admin, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      providerCampaignId: created.id,
    })

    return { providerCampaignId: created.id, deduplicated: false }
  } catch (error) {
    const normalized = normalizeCampaignCreationError(error, providerCreated)

    // Once Meta has accepted the campaign, keep the request in processing if
    // local completion fails. Replaying it could create a duplicate campaign.
    if (!providerCreated) {
      try {
        await failMetaMarketingCampaignCreation(admin, {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          errorCode: normalized.code,
        })
      } catch {
        // Preserve the original, bounded error. The request remains processing,
        // which is safer than allowing an automatic replay against Meta.
      }
    }
    throw normalized
  }
}

export async function postPausedMetaMarketingCampaign(
  adAccountId: string,
  accessToken: string,
  input: { name: string; objective: MetaMarketingCampaignObjective },
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const accountId = requireAdAccountId(adAccountId)
  const config = getMetaMarketingOAuthConfig()
  const url = new URL(
    `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(accountId)}/campaigns`,
  )
  const body = new URLSearchParams({
    name: input.name.trim(),
    objective: metaMarketingCampaignObjectiveSchema.parse(input.objective),
    status: 'PAUSED',
    special_ad_categories: '[]',
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)

  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch {
    throw new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_provider_unavailable',
      'provider',
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new MetaMarketingCampaignCreationError(
      response.status === 401 || response.status === 403
        ? 'meta_marketing_campaign_provider_unauthorized'
        : 'meta_marketing_campaign_provider_rejected',
      response.status === 401 || response.status === 403 ? 'connection' : 'provider',
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_provider_response_invalid',
      'provider',
    )
  }

  const parsed = providerResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_provider_response_invalid',
      'provider',
    )
  }
  return parsed.data
}

export function getMetaAdsManagerCampaignsUrl(adAccountId: string) {
  const numericId = requireAdAccountId(adAccountId).replace(/^act_/, '')
  const url = new URL('https://business.facebook.com/adsmanager/manage/campaigns')
  url.searchParams.set('act', numericId)
  return url.toString()
}

function requireAdAccountId(value: string) {
  const normalized = value.trim()
  if (!/^(?:act_)?\d{1,30}$/.test(normalized)) {
    throw new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_ad_account_invalid',
      'connection',
    )
  }
  return normalized.startsWith('act_') ? normalized : `act_${normalized}`
}

function normalizeCampaignCreationError(error: unknown, providerCreated: boolean) {
  if (providerCreated) {
    return new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_creation_completion_failed',
      'save',
    )
  }
  if (error instanceof MetaMarketingCampaignCreationError) return error
  if (error instanceof z.ZodError) {
    return new MetaMarketingCampaignCreationError(
      'meta_marketing_campaign_creation_context_invalid',
      'connection',
    )
  }
  return new MetaMarketingCampaignCreationError(
    'meta_marketing_campaign_creation_failed',
    'provider',
  )
}
