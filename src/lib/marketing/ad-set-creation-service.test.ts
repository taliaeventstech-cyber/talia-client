import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPausedMetaMarketingTrafficAdSet,
  postPausedMetaMarketingTrafficAdSet,
  toMinorCurrencyUnits,
} from './ad-set-creation-service'
import { buildMetaMarketingCredentialMetadata } from './credentials'

const tenantId = '657c9c3e-bf4a-45ce-868d-45a2f48db2fb'
const actorUserId = '0d423c31-f1cb-49a4-9b23-6876c1f06e19'
const requestId = '8ced31cc-e703-42f2-aa38-e657f1c484f4'
const connectionId = 'cf3e88d4-af56-4b67-a31e-ce4378b2a444'

describe('Meta Marketing paused traffic ad-set creation', () => {
  beforeEach(() => {
    vi.stubEnv('META_MARKETING_APP_ID', 'meta-app-id')
    vi.stubEnv('META_MARKETING_APP_SECRET', 'meta-app-secret')
    vi.stubEnv('META_MARKETING_GRAPH_API_VERSION', 'v26.0')
    vi.stubEnv('META_MARKETING_TOKEN_ENCRYPTION_KEY', 'encryption-key-that-is-at-least-32-characters')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('converts account-currency values to exact minor units', () => {
    expect(toMinorCurrencyUnits('20.35', 'EUR')).toBe(2035)
    expect(toMinorCurrencyUnits('2000', 'JPY')).toBe(2000)
    expect(toMinorCurrencyUnits('12.345', 'BHD')).toBe(12345)
    expect(() => toMinorCurrencyUnits('20.999', 'EUR')).toThrow('amount_precision_invalid')
  })

  it('forces the traffic delivery contract and PAUSED status in the provider request', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: '555666777' }))

    await expect(postPausedMetaMarketingTrafficAdSet(
      'act_123456',
      'sensitive-token',
      {
        providerCampaignId: '987654321',
        name: 'Spain traffic',
        dailyBudgetMinor: 2000,
        startTime: '2026-11-01T09:00:00.000Z',
        endTime: '2026-11-15T22:00:00.000Z',
        countries: ['ES', 'PT'],
        ageMin: 18,
        ageMax: 45,
      },
      { fetcher: fetcher as typeof fetch },
    )).resolves.toEqual({ id: '555666777' })

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    const body = init.body as URLSearchParams
    expect(url.toString()).toBe('https://graph.facebook.com/v26.0/act_123456/adsets')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sensitive-token' })
    expect(body.get('campaign_id')).toBe('987654321')
    expect(body.get('daily_budget')).toBe('2000')
    expect(body.get('billing_event')).toBe('IMPRESSIONS')
    expect(body.get('optimization_goal')).toBe('LINK_CLICKS')
    expect(body.get('bid_strategy')).toBe('LOWEST_COST_WITHOUT_CAP')
    expect(body.get('status')).toBe('PAUSED')
    expect(JSON.parse(body.get('targeting') ?? '{}')).toEqual({
      geo_locations: { countries: ['ES', 'PT'] },
      age_min: 18,
      age_max: 45,
    })
    expect(body.has('publisher_platforms')).toBe(false)
  })

  it('claims, creates and completes an ad set without exposing the token to RPCs', async () => {
    const credentialMetadata = buildMetaMarketingCredentialMetadata({
      accessToken: 'sensitive-token',
      expiresAt: '2030-12-04T10:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_meta_marketing_connection_summary') {
        return { data: connectionSummary(), error: null }
      }
      if (name === 'claim_meta_marketing_ad_set_creation') {
        return {
          data: {
            outcome: 'claimed',
            request_id: requestId,
            connection_id: connectionId,
            ad_account_id: 'act_123456',
            currency: 'EUR',
            credential_metadata: credentialMetadata,
          },
          error: null,
        }
      }
      if (name === 'complete_meta_marketing_ad_set_creation') {
        return { data: true, error: null }
      }
      return { data: null, error: new Error('unexpected_rpc') }
    })
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: '555666777' }))

    await expect(createPausedMetaMarketingTrafficAdSet(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-10T10:00:00.000Z') },
    )).resolves.toEqual({ providerAdSetId: '555666777', deduplicated: false })

    expect(rpc).toHaveBeenCalledWith('claim_meta_marketing_ad_set_creation', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_provider_campaign_id: '987654321',
      p_name: 'Spain traffic',
      p_daily_budget_minor: 2035,
      p_expected_currency: 'EUR',
      p_start_time: '2026-11-01T09:00:00.000Z',
      p_end_time: '2026-11-15T22:00:00.000Z',
      p_countries: ['ES', 'PT'],
      p_age_min: 18,
      p_age_max: 45,
    })
    expect(rpc).toHaveBeenCalledWith('complete_meta_marketing_ad_set_creation', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_provider_ad_set_id: '555666777',
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('sensitive-token')
  })

  it('does not call Meta when the idempotency request already succeeded', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_meta_marketing_connection_summary') {
        return { data: connectionSummary(), error: null }
      }
      return {
        data: {
          outcome: 'succeeded',
          request_id: requestId,
          provider_ad_set_id: '555666777',
        },
        error: null,
      }
    })
    const fetcher = vi.fn()

    await expect(createPausedMetaMarketingTrafficAdSet(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-10T10:00:00.000Z') },
    )).resolves.toEqual({ providerAdSetId: '555666777', deduplicated: true })

    expect(fetcher).not.toHaveBeenCalled()
  })

  it('records a bounded provider failure without persisting the raw response', async () => {
    const credentialMetadata = buildMetaMarketingCredentialMetadata({
      accessToken: 'sensitive-token',
      expiresAt: '2030-12-04T10:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_meta_marketing_connection_summary') {
        return { data: connectionSummary(), error: null }
      }
      if (name === 'claim_meta_marketing_ad_set_creation') {
        return {
          data: {
            outcome: 'claimed',
            request_id: requestId,
            connection_id: connectionId,
            ad_account_id: 'act_123456',
            currency: 'EUR',
            credential_metadata: credentialMetadata,
          },
          error: null,
        }
      }
      if (name === 'fail_meta_marketing_ad_set_creation') {
        return { data: true, error: null }
      }
      return { data: null, error: new Error('unexpected_rpc') }
    })
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(
      { error: { message: 'private provider detail' } },
      400,
    ))

    await expect(createPausedMetaMarketingTrafficAdSet(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-10T10:00:00.000Z') },
    )).rejects.toMatchObject({
      code: 'meta_marketing_ad_set_provider_rejected',
      kind: 'provider',
    })

    expect(rpc).toHaveBeenCalledWith('fail_meta_marketing_ad_set_creation', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_error_code: 'meta_marketing_ad_set_provider_rejected',
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('private provider detail')
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('sensitive-token')
  })

  it('rejects an invalid schedule before reading connection data', async () => {
    const rpc = vi.fn()

    await expect(createPausedMetaMarketingTrafficAdSet(
      { rpc } as never,
      { ...validInput(), startTime: '2026-10-09T09:00:00.000Z' },
      { now: Date.parse('2026-10-10T10:00:00.000Z') },
    )).rejects.toMatchObject({ kind: 'invalid' })

    expect(rpc).not.toHaveBeenCalled()
  })
})

function validInput() {
  return {
    tenantId,
    actorUserId,
    requestId,
    providerCampaignId: '987654321',
    name: 'Spain traffic',
    dailyBudget: '20.35',
    startTime: '2026-11-01T09:00:00.000Z',
    endTime: '2026-11-15T22:00:00.000Z',
    countries: ['pt', 'ES'],
    ageMin: 18,
    ageMax: 45,
  }
}

function connectionSummary() {
  return {
    id: connectionId,
    status: 'connected',
    business_id: 'business-1',
    business_name: 'TALIA',
    ad_account_id: 'act_123456',
    ad_account_name: 'TALIA Ads',
    ad_account_currency: 'EUR',
    rollout_enabled: true,
    scopes: ['ads_read', 'ads_management', 'business_management'],
    connected_at: '2026-10-01T10:00:00.000Z',
    token_expires_at: '2030-12-04T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
  }
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
