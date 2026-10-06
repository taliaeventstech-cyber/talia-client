import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMetaMarketingSnapshot } from './insights-service'

describe('fetchMetaMarketingSnapshot', () => {
  beforeEach(() => {
    vi.stubEnv('META_MARKETING_APP_ID', 'meta-app-id')
    vi.stubEnv('META_MARKETING_APP_SECRET', 'meta-app-secret')
    vi.stubEnv('META_MARKETING_GRAPH_API_VERSION', 'v26.0')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('keeps account totals separate and joins campaign-level Insights', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      expect(init?.headers).toEqual({ Authorization: 'Bearer sensitive-token' })
      expect(url.searchParams.has('access_token')).toBe(false)

      if (url.pathname.endsWith('/campaigns')) {
        if (url.searchParams.get('after') === 'one') return jsonResponse({ data: [] })
        return jsonResponse({ data: [{
          id: 'campaign-1',
          name: 'Autumn season',
          status: 'PAUSED',
          effective_status: 'PAUSED',
          objective: 'OUTCOME_TRAFFIC',
          created_time: '2026-09-01T10:00:00+0000',
          updated_time: '2026-10-01T10:00:00+0000',
        }], paging: {
          next: 'https://graph.facebook.com/v26.0/act_123456/campaigns?after=one&access_token=provider-token',
        } })
      }

      if (
        url.searchParams.get('level') === 'account'
        && url.searchParams.get('time_increment') === '1'
      ) {
        return jsonResponse({ data: [
          {
            spend: '45.50',
            impressions: '4000',
            reach: '3500',
            inline_link_clicks: '90',
            ctr: '2.25',
            cpc: '0.51',
            frequency: '1.14',
            date_start: '2026-10-04',
            date_stop: '2026-10-04',
          },
          {
            spend: '80.00',
            impressions: '6000',
            reach: '5000',
            inline_link_clicks: '160',
            ctr: '2.67',
            cpc: '0.50',
            frequency: '1.20',
            date_start: '2026-10-05',
            date_stop: '2026-10-05',
          },
        ] })
      }

      if (url.searchParams.get('level') === 'account') {
        return jsonResponse({ data: [{
          spend: '125.50',
          impressions: '10000',
          reach: '8000',
          inline_link_clicks: '250',
          ctr: '2.50',
          cpc: '0.50',
          frequency: '1.25',
          date_start: '2026-09-06',
          date_stop: '2026-10-05',
        }] })
      }

      return jsonResponse({ data: [{
        campaign_id: 'campaign-1',
        spend: '75.25',
        impressions: '6000',
        reach: '5000',
        inline_link_clicks: '180',
        ctr: '3.00',
        cpc: '0.42',
        frequency: '1.20',
        date_start: '2026-09-06',
        date_stop: '2026-10-05',
      }] })
    })

    const snapshot = await fetchMetaMarketingSnapshot(
      '123456',
      'sensitive-token',
      { fetcher: fetcher as typeof fetch },
    )

    expect(snapshot.summary).toMatchObject({
      spend: 125.5,
      reach: 8000,
      link_clicks: 250,
      ctr: 2.5,
      cpc: 0.5,
    })
    expect(snapshot.campaigns).toEqual([expect.objectContaining({
      campaign_id: 'campaign-1',
      name: 'Autumn season',
      spend: 75.25,
      link_clicks: 180,
      campaign_created_at: '2026-09-01T10:00:00.000Z',
    })])
    expect(snapshot.daily_insights).toHaveLength(30)
    expect(snapshot.daily_insights.find(({ date }) => date === '2026-10-04')).toMatchObject({
      spend: 45.5,
      link_clicks: 90,
    })
    expect(snapshot.daily_insights.find(({ date }) => date === '2026-09-07')).toEqual({
      date: '2026-09-07',
      spend: 0,
      impressions: 0,
      reach: 0,
      link_clicks: 0,
      ctr: 0,
      cpc: null,
      frequency: 0,
    })
    expect(fetcher).toHaveBeenCalledTimes(5)
    expect(fetcher.mock.calls.every(([input]) => input.toString().includes('/act_123456/'))).toBe(true)
  })

  it('returns a valid empty snapshot for a new ad account', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ data: [] })))

    await expect(fetchMetaMarketingSnapshot('act_123', 'token', {
      fetcher: fetcher as typeof fetch,
    })).resolves.toEqual({
      summary: {
        spend: 0,
        impressions: 0,
        reach: 0,
        link_clicks: 0,
        ctr: 0,
        cpc: null,
        frequency: 0,
        date_start: null,
        date_stop: null,
      },
      campaigns: [],
      daily_insights: [],
    })
  })

  it('rejects malformed provider metrics instead of persisting them', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      if (url.pathname.endsWith('/campaigns')) return jsonResponse({ data: [] })
      if (
        url.searchParams.get('level') === 'account'
        && url.searchParams.get('time_increment') !== '1'
      ) {
        return jsonResponse({ data: [{ spend: 'not-a-number' }] })
      }
      return jsonResponse({ data: [] })
    })

    await expect(fetchMetaMarketingSnapshot('act_123', 'token', {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('meta_marketing_insights_metric_invalid')
  })

  it('rejects a daily row that does not represent exactly one day', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      if (
        url.searchParams.get('level') === 'account'
        && url.searchParams.get('time_increment') === '1'
      ) {
        return jsonResponse({ data: [{
          spend: '1.00',
          date_start: '2026-10-04',
          date_stop: '2026-10-05',
        }] })
      }
      return jsonResponse({ data: [] })
    })

    await expect(fetchMetaMarketingSnapshot('act_123', 'token', {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('meta_marketing_daily_insights_date_invalid')
  })
})

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
