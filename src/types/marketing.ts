import { z } from 'zod'

export const metaMarketingConnectionSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(['connected', 'error', 'revoked', 'disabled']),
  business_id: z.string().min(1),
  business_name: z.string().min(1).nullable(),
  ad_account_id: z.string().min(1),
  ad_account_name: z.string().min(1).nullable(),
  ad_account_currency: z.string().length(3).nullable(),
  rollout_enabled: z.boolean(),
  scopes: z.array(z.string()),
  connected_at: z.string().datetime({ offset: true }).nullable(),
  token_expires_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
})

export type MetaMarketingConnectionSummary = z.infer<
  typeof metaMarketingConnectionSummarySchema
>

const nullableDateTimeSchema = z.string().datetime({ offset: true }).nullable()

export const metaMarketingAccountInsightSchema = z.object({
  spend: z.number().nonnegative(),
  impressions: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  link_clicks: z.number().int().nonnegative(),
  ctr: z.number().nonnegative(),
  cpc: z.number().nonnegative().nullable(),
  frequency: z.number().nonnegative(),
  date_start: z.string().date().nullable(),
  date_stop: z.string().date().nullable(),
})

export const metaMarketingCampaignSnapshotSchema = z.object({
  campaign_id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  configured_status: z.string().min(1).max(100),
  effective_status: z.string().min(1).max(100),
  objective: z.string().min(1).max(200).nullable(),
  campaign_created_at: nullableDateTimeSchema,
  campaign_updated_at: nullableDateTimeSchema,
  starts_at: nullableDateTimeSchema,
  ends_at: nullableDateTimeSchema,
  spend: z.number().nonnegative(),
  impressions: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  link_clicks: z.number().int().nonnegative(),
  ctr: z.number().nonnegative(),
  cpc: z.number().nonnegative().nullable(),
  frequency: z.number().nonnegative(),
  insights_date_start: z.string().date().nullable(),
  insights_date_stop: z.string().date().nullable(),
})

export const metaMarketingDailyInsightSchema = z.object({
  date: z.string().date(),
  spend: z.number().nonnegative(),
  impressions: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  link_clicks: z.number().int().nonnegative(),
  ctr: z.number().nonnegative(),
  cpc: z.number().nonnegative().nullable(),
  frequency: z.number().nonnegative(),
})

export const metaMarketingDashboardSnapshotSchema = z.object({
  status: z.enum(['never', 'success', 'error']),
  last_attempted_at: nullableDateTimeSchema,
  last_synced_at: nullableDateTimeSchema,
  error_code: z.string().nullable(),
  summary: metaMarketingAccountInsightSchema.nullable(),
  campaigns: z.array(metaMarketingCampaignSnapshotSchema).max(500),
  daily_insights: z.array(metaMarketingDailyInsightSchema).max(31).default([]),
})

export type MetaMarketingAccountInsight = z.infer<
  typeof metaMarketingAccountInsightSchema
>
export type MetaMarketingCampaignSnapshot = z.infer<
  typeof metaMarketingCampaignSnapshotSchema
>
export type MetaMarketingDailyInsight = z.infer<
  typeof metaMarketingDailyInsightSchema
>
export type MetaMarketingDashboardSnapshot = z.infer<
  typeof metaMarketingDashboardSnapshotSchema
>
