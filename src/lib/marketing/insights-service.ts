import { z } from 'zod'
import type {
  MetaMarketingAccountInsight,
  MetaMarketingCampaignSnapshot,
  MetaMarketingDailyInsight,
} from '@/types/marketing'
import { getMetaMarketingOAuthConfig } from './oauth'

const MAX_GRAPH_PAGES = 5
const MAX_CAMPAIGNS = 500
const MAX_DAILY_INSIGHTS = 31

const campaignSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  status: z.string().min(1).max(100),
  effective_status: z.string().min(1).max(100),
  objective: z.string().min(1).max(200).nullable().optional(),
  created_time: z.string().min(1).optional(),
  updated_time: z.string().min(1).optional(),
  start_time: z.string().min(1).optional(),
  stop_time: z.string().min(1).optional(),
})

const insightSchema = z.object({
  campaign_id: z.string().min(1).max(200).optional(),
  spend: z.string().optional(),
  impressions: z.string().optional(),
  reach: z.string().optional(),
  inline_link_clicks: z.string().optional(),
  ctr: z.string().optional(),
  cpc: z.string().optional(),
  frequency: z.string().optional(),
  date_start: z.string().date().optional(),
  date_stop: z.string().date().optional(),
})

type FetchOptions = { fetcher?: typeof fetch; timeoutMs?: number }

export type MetaMarketingProviderSnapshot = {
  summary: MetaMarketingAccountInsight
  campaigns: MetaMarketingCampaignSnapshot[]
  daily_insights: MetaMarketingDailyInsight[]
}

export class MetaMarketingInsightsError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number | null = null,
  ) {
    super(code)
    this.name = 'MetaMarketingInsightsError'
  }
}

export async function fetchMetaMarketingSnapshot(
  adAccountId: string,
  accessToken: string,
  options: FetchOptions = {},
): Promise<MetaMarketingProviderSnapshot> {
  const normalizedAccountId = normalizeAdAccountId(adAccountId)
  const campaignUrl = graphUrl(`/${encodeURIComponent(normalizedAccountId)}/campaigns`)
  campaignUrl.searchParams.set(
    'fields',
    'id,name,status,effective_status,objective,created_time,updated_time,start_time,stop_time',
  )
  campaignUrl.searchParams.set('limit', '100')

  const accountInsightsUrl = graphUrl(`/${encodeURIComponent(normalizedAccountId)}/insights`)
  setInsightParameters(accountInsightsUrl, 'account')

  const dailyInsightsUrl = graphUrl(`/${encodeURIComponent(normalizedAccountId)}/insights`)
  setInsightParameters(dailyInsightsUrl, 'account')
  dailyInsightsUrl.searchParams.set('time_increment', '1')

  const campaignInsightsUrl = graphUrl(`/${encodeURIComponent(normalizedAccountId)}/insights`)
  setInsightParameters(campaignInsightsUrl, 'campaign')

  const [campaigns, accountInsights, dailyInsights, campaignInsights] = await Promise.all([
    requestCollection(
      campaignUrl,
      campaignSchema,
      'meta_marketing_campaigns_request',
      accessToken,
      options,
    ),
    requestCollection(
      accountInsightsUrl,
      insightSchema,
      'meta_marketing_account_insights_request',
      accessToken,
      options,
    ),
    requestCollection(
      dailyInsightsUrl,
      insightSchema,
      'meta_marketing_daily_insights_request',
      accessToken,
      options,
    ),
    requestCollection(
      campaignInsightsUrl,
      insightSchema,
      'meta_marketing_campaign_insights_request',
      accessToken,
      options,
    ),
  ])

  if (campaigns.length > MAX_CAMPAIGNS) {
    throw new MetaMarketingInsightsError('meta_marketing_campaign_limit_exceeded')
  }

  const insightByCampaign = new Map(
    campaignInsights
      .filter((insight) => insight.campaign_id)
      .map((insight) => [insight.campaign_id!, insight]),
  )

  const summary = mapInsight(accountInsights[0])
  return {
    summary,
    daily_insights: normalizeDailyInsights(
      dailyInsights.map(mapDailyInsight),
      summary.date_start,
      summary.date_stop,
    ),
    campaigns: campaigns.map((campaign) => {
      const insight = mapInsight(insightByCampaign.get(campaign.id))
      return {
        campaign_id: campaign.id,
        name: campaign.name,
        configured_status: campaign.status,
        effective_status: campaign.effective_status,
        objective: campaign.objective ?? null,
        campaign_created_at: normalizeDateTime(campaign.created_time),
        campaign_updated_at: normalizeDateTime(campaign.updated_time),
        starts_at: normalizeDateTime(campaign.start_time),
        ends_at: normalizeDateTime(campaign.stop_time),
        spend: insight.spend,
        impressions: insight.impressions,
        reach: insight.reach,
        link_clicks: insight.link_clicks,
        ctr: insight.ctr,
        cpc: insight.cpc,
        frequency: insight.frequency,
        insights_date_start: insight.date_start,
        insights_date_stop: insight.date_stop,
      }
    }),
  }
}

function normalizeDailyInsights(
  insights: MetaMarketingDailyInsight[],
  periodStart: string | null,
  periodStop: string | null,
) {
  if (insights.length === 0) return []
  const insightByDate = new Map<string, MetaMarketingDailyInsight>()
  for (const insight of insights) {
    if (insightByDate.has(insight.date)) {
      throw new MetaMarketingInsightsError('meta_marketing_daily_insights_duplicate')
    }
    insightByDate.set(insight.date, insight)
  }

  const dates = [...insightByDate.keys()].sort()
  const start = periodStart ?? dates[0]
  const stop = periodStop ?? dates.at(-1)!
  if (start > stop || dates[0] < start || dates.at(-1)! > stop) {
    throw new MetaMarketingInsightsError('meta_marketing_daily_insights_period_invalid')
  }
  const cursor = new Date(`${start}T00:00:00Z`)
  const end = new Date(`${stop}T00:00:00Z`)
  const normalized: MetaMarketingDailyInsight[] = []

  while (cursor <= end && normalized.length < MAX_DAILY_INSIGHTS) {
    const date = cursor.toISOString().slice(0, 10)
    normalized.push(insightByDate.get(date) ?? {
      date,
      spend: 0,
      impressions: 0,
      reach: 0,
      link_clicks: 0,
      ctr: 0,
      cpc: null,
      frequency: 0,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (cursor <= end) {
    throw new MetaMarketingInsightsError('meta_marketing_daily_insights_limit_exceeded')
  }
  return normalized
}

function mapDailyInsight(
  insight: z.infer<typeof insightSchema>,
): MetaMarketingDailyInsight {
  if (!insight.date_start || insight.date_start !== insight.date_stop) {
    throw new MetaMarketingInsightsError('meta_marketing_daily_insights_date_invalid')
  }
  const mapped = mapInsight(insight)
  return {
    date: insight.date_start,
    spend: mapped.spend,
    impressions: mapped.impressions,
    reach: mapped.reach,
    link_clicks: mapped.link_clicks,
    ctr: mapped.ctr,
    cpc: mapped.cpc,
    frequency: mapped.frequency,
  }
}

function setInsightParameters(url: URL, level: 'account' | 'campaign') {
  url.searchParams.set('level', level)
  url.searchParams.set('date_preset', 'last_30d')
  url.searchParams.set(
    'fields',
    level === 'campaign'
      ? 'campaign_id,spend,impressions,reach,inline_link_clicks,ctr,cpc,frequency,date_start,date_stop'
      : 'spend,impressions,reach,inline_link_clicks,ctr,cpc,frequency,date_start,date_stop',
  )
  url.searchParams.set('limit', '100')
}

function mapInsight(insight: z.infer<typeof insightSchema> | undefined): MetaMarketingAccountInsight {
  return {
    spend: parseMetric(insight?.spend),
    impressions: parseIntegerMetric(insight?.impressions),
    reach: parseIntegerMetric(insight?.reach),
    link_clicks: parseIntegerMetric(insight?.inline_link_clicks),
    ctr: parseMetric(insight?.ctr),
    cpc: insight?.cpc === undefined ? null : parseMetric(insight.cpc),
    frequency: parseMetric(insight?.frequency),
    date_start: insight?.date_start ?? null,
    date_stop: insight?.date_stop ?? null,
  }
}

async function requestCollection<T>(
  initialUrl: URL,
  itemSchema: z.ZodType<T>,
  operation: string,
  accessToken: string,
  options: FetchOptions,
) {
  const schema = z.object({
    data: z.array(itemSchema),
    paging: z.object({ next: z.url().optional() }).optional(),
  })
  const result: T[] = []
  let url: URL | null = initialUrl
  let page = 0

  while (url && page < MAX_GRAPH_PAGES) {
    const payload: { data: T[]; paging?: { next?: string } } = await requestJson(
      url,
      schema,
      operation,
      accessToken,
      options,
    )
    result.push(...payload.data)
    url = payload.paging?.next ? safeGraphNextUrl(payload.paging.next) : null
    page += 1
  }
  return result
}

async function requestJson<T>(
  url: URL,
  schema: z.ZodType<T>,
  operation: string,
  accessToken: string,
  options: FetchOptions,
): Promise<T> {
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${requireValue(accessToken)}` },
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      cache: 'no-store',
    })
  } catch {
    throw new MetaMarketingInsightsError('meta_marketing_insights_network_error')
  }

  if (!response.ok) {
    throw new MetaMarketingInsightsError(
      `${operation}_http_${response.status}`,
      response.status,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new MetaMarketingInsightsError(`${operation}_invalid_response`, response.status)
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new MetaMarketingInsightsError(`${operation}_invalid_response`, response.status)
  }
  return parsed.data
}

function graphUrl(path: string) {
  return new URL(`https://graph.facebook.com/${getMetaMarketingOAuthConfig().graphVersion}${path}`)
}

function safeGraphNextUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'graph.facebook.com') {
    throw new MetaMarketingInsightsError('meta_marketing_insights_pagination_url_invalid')
  }
  url.searchParams.delete('access_token')
  return url
}

function normalizeAdAccountId(value: string) {
  const normalized = requireValue(value)
  return normalized.startsWith('act_') ? normalized : `act_${normalized}`
}

function requireValue(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized.length > 1000) {
    throw new MetaMarketingInsightsError('meta_marketing_insights_input_invalid')
  }
  return normalized
}

function parseMetric(value: string | undefined) {
  if (value === undefined) return 0
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new MetaMarketingInsightsError('meta_marketing_insights_metric_invalid')
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new MetaMarketingInsightsError('meta_marketing_insights_metric_invalid')
  }
  return parsed
}

function parseIntegerMetric(value: string | undefined) {
  const parsed = parseMetric(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new MetaMarketingInsightsError('meta_marketing_insights_metric_invalid')
  }
  return parsed
}

function normalizeDateTime(value: string | undefined) {
  if (!value) return null
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    throw new MetaMarketingInsightsError('meta_marketing_campaign_date_invalid')
  }
  return timestamp.toISOString()
}
