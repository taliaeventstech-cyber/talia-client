import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getMetaMarketingConnectionSummary,
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
})

afterEach(() => vi.unstubAllEnvs())
