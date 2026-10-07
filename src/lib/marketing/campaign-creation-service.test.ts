import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMetaMarketingCredentialMetadata } from './credentials'
import {
  createPausedMetaMarketingCampaign,
  postPausedMetaMarketingCampaign,
} from './campaign-creation-service'

const tenantId = '657c9c3e-bf4a-45ce-868d-45a2f48db2fb'
const actorUserId = '0d423c31-f1cb-49a4-9b23-6876c1f06e19'
const requestId = '8ced31cc-e703-42f2-aa38-e657f1c484f4'
const connectionId = 'cf3e88d4-af56-4b67-a31e-ce4378b2a444'

describe('Meta Marketing paused campaign creation', () => {
  beforeEach(() => {
    vi.stubEnv('META_MARKETING_APP_ID', 'meta-app-id')
    vi.stubEnv('META_MARKETING_APP_SECRET', 'meta-app-secret')
    vi.stubEnv('META_MARKETING_GRAPH_API_VERSION', 'v26.0')
    vi.stubEnv('META_MARKETING_TOKEN_ENCRYPTION_KEY', 'encryption-key-that-is-at-least-32-characters')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('forces PAUSED and an empty special-ad category list in the provider request', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: '987654321' }))

    await expect(postPausedMetaMarketingCampaign(
      '123456',
      'sensitive-token',
      { name: 'Autumn tickets', objective: 'OUTCOME_TRAFFIC' },
      { fetcher: fetcher as typeof fetch },
    )).resolves.toEqual({ id: '987654321' })

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    const body = init.body as URLSearchParams
    expect(url.toString()).toBe('https://graph.facebook.com/v26.0/act_123456/campaigns')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sensitive-token' })
    expect(body.get('name')).toBe('Autumn tickets')
    expect(body.get('objective')).toBe('OUTCOME_TRAFFIC')
    expect(body.get('status')).toBe('PAUSED')
    expect(body.get('special_ad_categories')).toBe('[]')
    expect(body.has('daily_budget')).toBe(false)
  })

  it('claims the request, creates once in Meta and completes the audit record', async () => {
    const credentialMetadata = buildMetaMarketingCredentialMetadata({
      accessToken: 'sensitive-token',
      tokenType: 'bearer',
      expiresAt: '2030-12-04T10:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_meta_marketing_campaign_creation') {
        return {
          data: {
            outcome: 'claimed',
            request_id: requestId,
            connection_id: connectionId,
            ad_account_id: 'act_123456',
            credential_metadata: credentialMetadata,
          },
          error: null,
        }
      }
      if (name === 'complete_meta_marketing_campaign_creation') {
        return { data: true, error: null }
      }
      return { data: null, error: new Error('unexpected_rpc') }
    })
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: '987654321' }))

    await expect(createPausedMetaMarketingCampaign(
      { rpc } as never,
      {
        tenantId,
        actorUserId,
        requestId,
        name: 'Autumn tickets',
        objective: 'OUTCOME_TRAFFIC',
      },
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-07T10:00:00.000Z') },
    )).resolves.toEqual({ providerCampaignId: '987654321', deduplicated: false })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('complete_meta_marketing_campaign_creation', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_provider_campaign_id: '987654321',
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('sensitive-token')
  })

  it('returns the previous provider id without calling Meta for a completed request', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        outcome: 'succeeded',
        request_id: requestId,
        provider_campaign_id: '987654321',
      },
      error: null,
    }))
    const fetcher = vi.fn()

    await expect(createPausedMetaMarketingCampaign(
      { rpc } as never,
      {
        tenantId,
        actorUserId,
        requestId,
        name: 'Autumn tickets',
        objective: 'OUTCOME_TRAFFIC',
      },
      { fetcher: fetcher as typeof fetch },
    )).resolves.toEqual({ providerCampaignId: '987654321', deduplicated: true })

    expect(fetcher).not.toHaveBeenCalled()
  })

  it('records a bounded provider failure without persisting the raw response', async () => {
    const credentialMetadata = buildMetaMarketingCredentialMetadata({
      accessToken: 'sensitive-token',
      expiresAt: '2030-12-04T10:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_meta_marketing_campaign_creation') {
        return {
          data: {
            outcome: 'claimed',
            request_id: requestId,
            connection_id: connectionId,
            ad_account_id: 'act_123456',
            credential_metadata: credentialMetadata,
          },
          error: null,
        }
      }
      if (name === 'fail_meta_marketing_campaign_creation') {
        return { data: true, error: null }
      }
      return { data: null, error: new Error('unexpected_rpc') }
    })
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(
      { error: { message: 'private provider detail' } },
      400,
    ))

    await expect(createPausedMetaMarketingCampaign(
      { rpc } as never,
      {
        tenantId,
        actorUserId,
        requestId,
        name: 'Autumn tickets',
        objective: 'OUTCOME_TRAFFIC',
      },
      { fetcher: fetcher as typeof fetch },
    )).rejects.toMatchObject({
      code: 'meta_marketing_campaign_provider_rejected',
      kind: 'provider',
    })

    expect(rpc).toHaveBeenCalledWith('fail_meta_marketing_campaign_creation', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_error_code: 'meta_marketing_campaign_provider_rejected',
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('private provider detail')
  })
})

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
