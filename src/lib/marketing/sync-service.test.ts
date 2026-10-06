import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMetaMarketingCredentialMetadata } from './credentials'
import { syncMetaMarketingSnapshot } from './sync-service'

const tenantId = '657c9c3e-bf4a-45ce-868d-45a2f48db2fb'
const actorUserId = '0d423c31-f1cb-49a4-9b23-6876c1f06e19'
const connectionId = 'cf3e88d4-af56-4b67-a31e-ce4378b2a444'

describe('syncMetaMarketingSnapshot', () => {
  beforeEach(() => {
    vi.stubEnv('META_MARKETING_APP_ID', 'meta-app-id')
    vi.stubEnv('META_MARKETING_APP_SECRET', 'meta-app-secret')
    vi.stubEnv('META_MARKETING_TOKEN_ENCRYPTION_KEY', 'encryption-key-that-is-at-least-32-characters')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('reads credentials server-side and atomically persists an empty account snapshot', async () => {
    const metadata = buildMetaMarketingCredentialMetadata({
      accessToken: 'sensitive-token',
      tokenType: 'bearer',
      expiresAt: '2030-12-04T10:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_meta_marketing_sync_context') {
        return {
          data: {
            connection_id: connectionId,
            ad_account_id: 'act_123',
            currency: 'EUR',
            credential_metadata: metadata,
          },
          error: null,
        }
      }
      if (name === 'replace_meta_marketing_campaign_snapshot') {
        return { data: 0, error: null }
      }
      return { data: false, error: new Error('unexpected_rpc') }
    })
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ data: [] })))

    await expect(syncMetaMarketingSnapshot(
      { rpc } as never,
      { tenantId, actorUserId },
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-06T10:00:00.000Z') },
    )).resolves.toMatchObject({ campaigns: [], daily_insights: [], summary: { spend: 0 } })

    expect(rpc).toHaveBeenCalledWith('replace_meta_marketing_campaign_snapshot',
      expect.objectContaining({
        p_theatre_id: tenantId,
        p_connection_id: connectionId,
        p_campaigns: [],
        p_daily_insights: [],
      }))
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('sensitive-token')
  })

  it('records an expired-token failure without calling Meta', async () => {
    const metadata = buildMetaMarketingCredentialMetadata({
      accessToken: 'expired-token',
      tokenType: 'bearer',
      expiresAt: '2026-10-05T10:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_meta_marketing_sync_context') {
        return {
          data: {
            connection_id: connectionId,
            ad_account_id: 'act_123',
            currency: 'EUR',
            credential_metadata: metadata,
          },
          error: null,
        }
      }
      if (name === 'record_meta_marketing_sync_failure') return { data: true, error: null }
      return { data: null, error: new Error('unexpected_rpc') }
    })
    const fetcher = vi.fn()

    await expect(syncMetaMarketingSnapshot(
      { rpc } as never,
      { tenantId, actorUserId },
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-06T10:00:00.000Z') },
    )).rejects.toMatchObject({ kind: 'reauthorize' })

    expect(fetcher).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('record_meta_marketing_sync_failure', expect.objectContaining({
      p_error_code: 'meta_marketing_sync_token_expired',
    }))
  })
})

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
