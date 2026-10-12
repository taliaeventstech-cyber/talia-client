import type { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  claimMetaMarketingAdSetCreation,
  completeMetaMarketingAdSetCreation,
  failMetaMarketingAdSetCreation,
  getMetaMarketingConnectionSummary,
} from './connection-service'
import { parseMetaMarketingCredentialMetadata } from './credentials'
import { getMetaMarketingOAuthConfig } from './oauth'

type AdminClient = ReturnType<typeof createAdminClient>

const adSetInputSchema = z.object({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  requestId: z.uuid(),
  providerCampaignId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  dailyBudget: z.string().trim().regex(/^\d{1,10}(?:\.\d{1,4})?$/),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  countries: z.array(z.string().trim().length(2)).min(1).max(25),
  ageMin: z.number().int().min(18).max(65),
  ageMax: z.number().int().min(18).max(65),
})

const providerResponseSchema = z.object({
  id: z.string().min(1).max(200),
})

export class MetaMarketingAdSetCreationError extends Error {
  constructor(
    public readonly code: string,
    public readonly kind: 'invalid' | 'connection' | 'in_progress' | 'provider' | 'save',
  ) {
    super(code)
    this.name = 'MetaMarketingAdSetCreationError'
  }
}

export async function createPausedMetaMarketingTrafficAdSet(
  admin: AdminClient,
  rawInput: z.input<typeof adSetInputSchema>,
  options: { fetcher?: typeof fetch; timeoutMs?: number; now?: number } = {},
) {
  const parsed = adSetInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_creation_invalid',
      'invalid',
    )
  }
  const input = parsed.data
  const countries = [...new Set(input.countries.map((country) => country.toUpperCase()))].sort()
  if (countries.some((country) => !/^[A-Z]{2}$/.test(country)) || input.ageMax < input.ageMin) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_creation_invalid',
      'invalid',
    )
  }

  const now = options.now ?? Date.now()
  const startTime = Date.parse(input.startTime)
  const endTime = Date.parse(input.endTime)
  if (startTime <= now || endTime <= startTime || endTime > startTime + 366 * 86_400_000) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_schedule_invalid',
      'invalid',
    )
  }

  let connection
  try {
    connection = await getMetaMarketingConnectionSummary(admin, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
    })
  } catch {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_connection_unavailable',
      'connection',
    )
  }
  if (!connection?.ad_account_currency) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_currency_unavailable',
      'connection',
    )
  }

  let dailyBudgetMinor: number
  try {
    dailyBudgetMinor = toMinorCurrencyUnits(input.dailyBudget, connection.ad_account_currency)
  } catch {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_budget_invalid',
      'invalid',
    )
  }

  let claim
  try {
    claim = await claimMetaMarketingAdSetCreation(admin, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      providerCampaignId: input.providerCampaignId,
      name: input.name,
      dailyBudgetMinor,
      expectedCurrency: connection.ad_account_currency,
      startTime: input.startTime,
      endTime: input.endTime,
      countries,
      ageMin: input.ageMin,
      ageMax: input.ageMax,
    })
  } catch {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_creation_unavailable',
      'connection',
    )
  }

  if (claim.outcome === 'succeeded') {
    return { providerAdSetId: claim.provider_ad_set_id, deduplicated: true }
  }
  if (claim.outcome === 'processing') {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_creation_in_progress',
      'in_progress',
    )
  }
  if (claim.outcome === 'failed') {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_creation_retry_with_new_request',
      'provider',
    )
  }

  let providerCreated = false
  try {
    const credentials = parseMetaMarketingCredentialMetadata(claim.credential_metadata)
    if (Date.parse(credentials.expiresAt) <= now) {
      throw new MetaMarketingAdSetCreationError(
        'meta_marketing_ad_set_creation_token_expired',
        'connection',
      )
    }

    const created = await postPausedMetaMarketingTrafficAdSet(
      claim.ad_account_id,
      credentials.accessToken,
      {
        providerCampaignId: input.providerCampaignId,
        name: input.name,
        dailyBudgetMinor,
        startTime: input.startTime,
        endTime: input.endTime,
        countries,
        ageMin: input.ageMin,
        ageMax: input.ageMax,
      },
      options,
    )
    providerCreated = true

    await completeMetaMarketingAdSetCreation(admin, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      providerAdSetId: created.id,
    })

    return { providerAdSetId: created.id, deduplicated: false }
  } catch (error) {
    const normalized = normalizeAdSetCreationError(error, providerCreated)

    if (!providerCreated) {
      try {
        await failMetaMarketingAdSetCreation(admin, {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          errorCode: normalized.code,
        })
      } catch {
        // Preserve the original bounded error and leave the request claimed.
      }
    }
    throw normalized
  }
}

export async function postPausedMetaMarketingTrafficAdSet(
  adAccountId: string,
  accessToken: string,
  input: {
    providerCampaignId: string
    name: string
    dailyBudgetMinor: number
    startTime: string
    endTime: string
    countries: string[]
    ageMin: number
    ageMax: number
  },
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const accountId = requireAdAccountId(adAccountId)
  const config = getMetaMarketingOAuthConfig()
  const url = new URL(
    `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(accountId)}/adsets`,
  )
  const body = new URLSearchParams({
    name: input.name.trim(),
    campaign_id: requireProviderId(input.providerCampaignId),
    daily_budget: requirePositiveInteger(input.dailyBudgetMinor),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    start_time: z.string().datetime({ offset: true }).parse(input.startTime),
    end_time: z.string().datetime({ offset: true }).parse(input.endTime),
    targeting: JSON.stringify({
      geo_locations: { countries: input.countries },
      age_min: input.ageMin,
      age_max: input.ageMax,
    }),
    status: 'PAUSED',
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
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_provider_unavailable',
      'provider',
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new MetaMarketingAdSetCreationError(
      response.status === 401 || response.status === 403
        ? 'meta_marketing_ad_set_provider_unauthorized'
        : 'meta_marketing_ad_set_provider_rejected',
      response.status === 401 || response.status === 403 ? 'connection' : 'provider',
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_provider_response_invalid',
      'provider',
    )
  }

  const parsed = providerResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_provider_response_invalid',
      'provider',
    )
  }
  return parsed.data
}

export function toMinorCurrencyUnits(value: string, currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) throw new Error('currency_invalid')
  const fractionDigits = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: normalizedCurrency,
  }).resolvedOptions().maximumFractionDigits ?? 2
  if (fractionDigits > 4) throw new Error('currency_precision_unsupported')

  const match = /^(\d{1,10})(?:\.(\d{1,4}))?$/.exec(value.trim())
  if (!match) throw new Error('amount_invalid')
  const fraction = match[2] ?? ''
  if (fraction.length > fractionDigits) throw new Error('amount_precision_invalid')

  const minor = Number(match[1]) * (10 ** fractionDigits)
    + Number(fraction.padEnd(fractionDigits, '0') || '0')
  if (!Number.isSafeInteger(minor) || minor < 1 || minor > 1_000_000_000_000) {
    throw new Error('amount_out_of_range')
  }
  return minor
}

function requireAdAccountId(value: string) {
  const normalized = value.trim()
  if (!/^(?:act_)?\d{1,30}$/.test(normalized)) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_ad_account_invalid',
      'connection',
    )
  }
  return normalized.startsWith('act_') ? normalized : `act_${normalized}`
}

function requireProviderId(value: string) {
  const normalized = value.trim()
  if (!/^\d{1,30}$/.test(normalized)) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_campaign_invalid',
      'invalid',
    )
  }
  return normalized
}

function requirePositiveInteger(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_budget_invalid',
      'invalid',
    )
  }
  return String(value)
}

function normalizeAdSetCreationError(error: unknown, providerCreated: boolean) {
  if (providerCreated) {
    return new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_creation_completion_failed',
      'save',
    )
  }
  if (error instanceof MetaMarketingAdSetCreationError) return error
  if (error instanceof z.ZodError) {
    return new MetaMarketingAdSetCreationError(
      'meta_marketing_ad_set_creation_context_invalid',
      'connection',
    )
  }
  return new MetaMarketingAdSetCreationError(
    'meta_marketing_ad_set_creation_failed',
    'provider',
  )
}
