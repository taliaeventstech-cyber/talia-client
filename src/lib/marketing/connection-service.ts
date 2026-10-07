import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { z } from 'zod'
import {
  metaMarketingAccountInsightSchema,
  metaMarketingCampaignSnapshotSchema,
  metaMarketingConnectionSummarySchema,
  metaMarketingDailyInsightSchema,
  metaMarketingDashboardSnapshotSchema,
  metaMarketingPeriodSchema,
  type MetaMarketingAccountInsight,
  type MetaMarketingCampaignSnapshot,
  type MetaMarketingConnectionSummary,
  type MetaMarketingDailyInsight,
  type MetaMarketingDashboardSnapshot,
  type MetaMarketingPeriod,
  type MetaMarketingCampaignObjective,
} from '@/types/marketing'
import { buildMetaMarketingCredentialMetadata } from './credentials'

type AdminClient = ReturnType<typeof createAdminClient>

const syncContextSchema = z.object({
  connection_id: z.uuid(),
  ad_account_id: z.string().min(1).max(200),
  currency: z.string().length(3).nullable(),
  credential_metadata: z.unknown(),
})

export type MetaMarketingSyncContext = z.infer<typeof syncContextSchema>

const campaignCreationClaimSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('claimed'),
    request_id: z.uuid(),
    connection_id: z.uuid(),
    ad_account_id: z.string().min(1).max(200),
    credential_metadata: z.unknown(),
  }),
  z.object({
    outcome: z.literal('processing'),
    request_id: z.uuid(),
    provider_campaign_id: z.null(),
  }),
  z.object({
    outcome: z.literal('failed'),
    request_id: z.uuid(),
    provider_campaign_id: z.null(),
  }),
  z.object({
    outcome: z.literal('succeeded'),
    request_id: z.uuid(),
    provider_campaign_id: z.string().min(1).max(200),
  }),
])

export type MetaMarketingCampaignCreationClaim = z.infer<
  typeof campaignCreationClaimSchema
>

export async function getMetaMarketingConnectionSummary(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string },
): Promise<MetaMarketingConnectionSummary | null> {
  const { data, error } = await admin.rpc('get_meta_marketing_connection_summary', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
  })

  if (error) throw new Error('meta_marketing_connection_summary_failed')
  if (data === null) return null

  const parsed = metaMarketingConnectionSummarySchema.safeParse(data)
  if (!parsed.success) throw new Error('meta_marketing_connection_summary_invalid')
  return parsed.data
}

export async function saveMetaMarketingConnection(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    metaUserId: string
    business: { id: string; name: string }
    adAccount: { id: string; name: string; currency?: string }
    scopes: string[]
    credentials: {
      accessToken: string
      tokenType?: string
      expiresAt: string
    }
  },
) {
  const { data, error } = await admin.rpc('save_meta_marketing_connection', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_meta_user_id: input.metaUserId,
    p_business_id: input.business.id,
    p_business_name: input.business.name,
    p_ad_account_id: input.adAccount.id,
    p_ad_account_name: input.adAccount.name,
    p_ad_account_currency: input.adAccount.currency ?? null,
    p_scopes: input.scopes,
    p_credential_metadata: buildMetaMarketingCredentialMetadata(input.credentials),
  })

  const connectionId = z.uuid().safeParse(data)
  if (error || !connectionId.success) {
    throw new Error('meta_marketing_connection_save_failed')
  }
  return connectionId.data
}

export async function getMetaMarketingSyncContext(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string },
): Promise<MetaMarketingSyncContext | null> {
  const { data, error } = await admin.rpc('get_meta_marketing_sync_context', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
  })

  if (error) throw new Error('meta_marketing_sync_context_failed')
  if (data === null) return null
  const parsed = syncContextSchema.safeParse(data)
  if (!parsed.success) throw new Error('meta_marketing_sync_context_invalid')
  return parsed.data
}

export async function getMetaMarketingDashboardSnapshot(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    period?: MetaMarketingPeriod
  },
): Promise<MetaMarketingDashboardSnapshot | null> {
  const period = metaMarketingPeriodSchema.parse(input.period ?? 'last_30d')
  const { data, error } = await admin.rpc('get_meta_marketing_dashboard_snapshot', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_period: period,
  })

  if (error) throw new Error('meta_marketing_dashboard_snapshot_failed')
  if (data === null) return null
  const parsed = metaMarketingDashboardSnapshotSchema.safeParse(data)
  if (!parsed.success) throw new Error('meta_marketing_dashboard_snapshot_invalid')
  return parsed.data
}

export async function replaceMetaMarketingCampaignSnapshot(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    connectionId: string
    period?: MetaMarketingPeriod
    summary: MetaMarketingAccountInsight
    campaigns: MetaMarketingCampaignSnapshot[]
    dailyInsights: MetaMarketingDailyInsight[]
  },
) {
  const summary = metaMarketingAccountInsightSchema.parse(input.summary)
  const campaigns = z.array(metaMarketingCampaignSnapshotSchema).max(500).parse(input.campaigns)
  const period = metaMarketingPeriodSchema.parse(input.period ?? 'last_30d')
  const dailyInsights = z.array(metaMarketingDailyInsightSchema).max(90).parse(input.dailyInsights)
  const { data, error } = await admin.rpc('replace_meta_marketing_campaign_snapshot', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_connection_id: input.connectionId,
    p_period: period,
    p_summary: summary as unknown as Json,
    p_campaigns: campaigns as unknown as Json,
    p_daily_insights: dailyInsights as unknown as Json,
  })

  if (error || typeof data !== 'number' || data !== campaigns.length) {
    throw new Error('meta_marketing_snapshot_save_failed')
  }
  return data
}

export async function recordMetaMarketingSyncFailure(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    connectionId: string
    period?: MetaMarketingPeriod
    errorCode: string
  },
) {
  const { data, error } = await admin.rpc('record_meta_marketing_sync_failure', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_connection_id: input.connectionId,
    p_period: metaMarketingPeriodSchema.parse(input.period ?? 'last_30d'),
    p_error_code: input.errorCode,
  })
  if (error || data !== true) throw new Error('meta_marketing_sync_failure_record_failed')
}

export async function claimMetaMarketingCampaignCreation(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    requestId: string
    name: string
    objective: MetaMarketingCampaignObjective
  },
): Promise<MetaMarketingCampaignCreationClaim> {
  const { data, error } = await admin.rpc('claim_meta_marketing_campaign_creation', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_request_id: input.requestId,
    p_name: input.name,
    p_objective: input.objective,
    p_no_special_ad_category_confirmed: true,
  })
  if (error) throw new Error('meta_marketing_campaign_creation_claim_failed')

  const parsed = campaignCreationClaimSchema.safeParse(data)
  if (!parsed.success) throw new Error('meta_marketing_campaign_creation_claim_invalid')
  return parsed.data
}

export async function completeMetaMarketingCampaignCreation(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    requestId: string
    providerCampaignId: string
  },
) {
  const { data, error } = await admin.rpc('complete_meta_marketing_campaign_creation', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_request_id: input.requestId,
    p_provider_campaign_id: input.providerCampaignId,
  })
  if (error || data !== true) throw new Error('meta_marketing_campaign_creation_complete_failed')
}

export async function failMetaMarketingCampaignCreation(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    requestId: string
    errorCode: string
  },
) {
  const { data, error } = await admin.rpc('fail_meta_marketing_campaign_creation', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_request_id: input.requestId,
    p_error_code: input.errorCode,
  })
  if (error || data !== true) throw new Error('meta_marketing_campaign_creation_failure_record_failed')
}
