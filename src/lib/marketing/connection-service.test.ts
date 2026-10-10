import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getMetaMarketingConnectionSummary,
  getMetaMarketingDashboardSnapshot,
  listMetaMarketingEligibleTrafficCampaigns,
  replaceMetaMarketingCampaignSnapshot,
  saveMetaMarketingConnection,
} from './connection-service'

describe('getMetaMarketingConnectionSummary', () => {
  it('returns a validated connection summary', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: '657c9c3e-bf4a-45ce-868d-45a2f48db2fb',
        status: 'connected',
        business_id: 'business-1',
        business_name: 'TALIA Business',
        ad_account_id: 'act_123',
        ad_account_name: 'TALIA Ads',
        ad_account_currency: 'EUR',
        rollout_enabled: false,
        scopes: ['ads_read', 'ads_management'],
        connected_at: '2026-10-05T10:00:00.000Z',
        token_expires_at: '2026-12-04T10:00:00.000Z',
        updated_at: '2026-10-05T10:00:00.000Z',
      },
      error: null,
    })

    const result = await getMetaMarketingConnectionSummary(
      { rpc } as never,
      { tenantId: 'tenant-1', actorUserId: 'user-1' },
    )

    expect(rpc).toHaveBeenCalledWith('get_meta_marketing_connection_summary', {
      p_theatre_id: 'tenant-1',
      p_actor_user_id: 'user-1',
    })
    expect(result?.rollout_enabled).toBe(false)
  })

  it('rejects malformed provider metadata', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: 'not-a-uuid', status: 'connected' },
      error: null,
    })

    await expect(getMetaMarketingConnectionSummary(
      { rpc } as never,
      { tenantId: 'tenant-1', actorUserId: 'user-1' },
    )).rejects.toThrow('meta_marketing_connection_summary_invalid')
  })

  it('saves only encrypted credential metadata', async () => {
    vi.stubEnv(
      'META_MARKETING_TOKEN_ENCRYPTION_KEY',
      'encryption-key-that-is-at-least-32-characters',
    )
    const rpc = vi.fn().mockResolvedValue({
      data: '657c9c3e-bf4a-45ce-868d-45a2f48db2fb',
      error: null,
    })

    await expect(saveMetaMarketingConnection({ rpc } as never, {
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      metaUserId: 'meta-user-1',
      business: { id: 'business-1', name: 'TALIA Business' },
      adAccount: { id: 'act_1', name: 'TALIA Ads', currency: 'EUR' },
      scopes: ['ads_read', 'ads_management', 'business_management'],
      credentials: {
        accessToken: 'sensitive-access-token',
        tokenType: 'bearer',
        expiresAt: '2026-12-04T10:00:00.000Z',
      },
    })).resolves.toBe('657c9c3e-bf4a-45ce-868d-45a2f48db2fb')

    const metadata = rpc.mock.calls[0][1].p_credential_metadata
    expect(JSON.stringify(metadata)).not.toContain('sensitive-access-token')
    expect(metadata).toMatchObject({
      expires_at: '2026-12-04T10:00:00.000Z',
      token_type: 'bearer',
      encrypted_credentials: { alg: 'aes-256-gcm' },
    })
  })

  it('returns a validated dashboard snapshot', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: 'success',
        period: 'last_90d',
        last_attempted_at: '2026-10-06T10:00:00.000Z',
        last_synced_at: '2026-10-06T10:00:00.000Z',
        error_code: null,
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
        daily_insights: [{
          date: '2026-10-06',
          spend: 0,
          impressions: 0,
          reach: 0,
          link_clicks: 0,
          ctr: 0,
          cpc: null,
          frequency: 0,
        }],
      },
      error: null,
    })

    await expect(getMetaMarketingDashboardSnapshot(
      { rpc } as never,
      { tenantId: 'tenant-1', actorUserId: 'user-1', period: 'last_90d' },
    )).resolves.toMatchObject({ period: 'last_90d', status: 'success', campaigns: [], daily_insights: [{
      date: '2026-10-06',
    }] })
    expect(rpc).toHaveBeenCalledWith('get_meta_marketing_dashboard_snapshot', {
      p_theatre_id: 'tenant-1',
      p_actor_user_id: 'user-1',
      p_period: 'last_90d',
    })
  })

  it('keeps the dashboard available while the daily Insights migration rolls out', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: 'success',
        last_attempted_at: '2026-10-06T10:00:00.000Z',
        last_synced_at: '2026-10-06T10:00:00.000Z',
        error_code: null,
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
      },
      error: null,
    })

    await expect(getMetaMarketingDashboardSnapshot(
      { rpc } as never,
      { tenantId: 'tenant-1', actorUserId: 'user-1' },
    )).resolves.toMatchObject({ status: 'success', daily_insights: [] })
  })

  it('replaces only the requested period snapshot', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 0, error: null })

    await expect(replaceMetaMarketingCampaignSnapshot(
      { rpc } as never,
      {
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        connectionId: '657c9c3e-bf4a-45ce-868d-45a2f48db2fb',
        period: 'last_7d',
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
        dailyInsights: [],
      },
    )).resolves.toBe(0)

    expect(rpc).toHaveBeenCalledWith('replace_meta_marketing_campaign_snapshot',
      expect.objectContaining({ p_period: 'last_7d' }))
  })

  it('returns only validated eligible traffic campaign options', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        campaign_id: '123456',
        name: 'Traffic · Autumn',
        configured_status: 'PAUSED',
        source: 'talia',
      }],
      error: null,
    })

    await expect(listMetaMarketingEligibleTrafficCampaigns(
      { rpc } as never,
      { tenantId: 'tenant-1', actorUserId: 'user-1' },
    )).resolves.toEqual([expect.objectContaining({ campaign_id: '123456', source: 'talia' })])

    expect(rpc).toHaveBeenCalledWith('list_meta_marketing_eligible_traffic_campaigns', {
      p_theatre_id: 'tenant-1',
      p_actor_user_id: 'user-1',
    })
  })
})

afterEach(() => vi.unstubAllEnvs())
