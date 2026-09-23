import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  completeInstagramOAuthConnection,
  disconnectInstagramConnection,
  getInstagramConnectionSummary,
  saveInstagramConnection,
} from './connection-service'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Instagram connection service', () => {
  it('validates the account and persists only the long-lived credential', async () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'i'.repeat(32))
    const calls: string[] = []
    const rpc = vi.fn().mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      calls.push('save')
      expect(JSON.stringify(args.p_credential_metadata)).not.toContain('short-lived-token')
      expect(JSON.stringify(args.p_credential_metadata)).not.toContain('long-lived-token')
      return { data: '50000000-0000-4000-8000-000000000001', error: null }
    })

    const result = await completeInstagramOAuthConnection({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      code: 'single-use-code',
    }, {
      exchangeCode: async () => ({ access_token: 'short-lived-token' }),
      exchangeLongLivedToken: async () => ({
        access_token: 'long-lived-token',
        token_type: 'bearer',
        expires_in: 5_184_000,
      }),
      fetchProfile: async () => ({
        id: '17841400000000000',
        username: 'venue_account',
        accountType: 'business',
      }),
      subscribeWebhooks: async (accessToken) => {
        expect(accessToken).toBe('long-lived-token')
        calls.push('subscribe')
      },
      now: () => Date.parse('2026-09-21T10:00:00.000Z'),
    })

    expect(calls).toEqual(['subscribe', 'save'])
    const [, saveArgs] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(saveArgs.p_instagram_user_id).toBe('17841400000000000')
    expect(result).toEqual({
      connectionId: '50000000-0000-4000-8000-000000000001',
      username: 'venue_account',
      accountType: 'business',
      expiresAt: '2026-11-20T10:00:00.000Z',
    })
  })

  it('persists an encrypted token envelope and the minimum scopes', async () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'i'.repeat(32))
    const rpc = vi.fn().mockResolvedValue({
      data: '50000000-0000-4000-8000-000000000001',
      error: null,
    })

    await expect(saveInstagramConnection({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      instagramUserId: '17841400000000000',
      username: 'venue_account',
      accountType: 'business',
      credentials: {
        accessToken: 'long-lived-token',
        tokenType: 'bearer',
        expiresAt: '2026-11-20T10:00:00.000Z',
      },
    })).resolves.toBe('50000000-0000-4000-8000-000000000001')

    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(args.p_scopes).toEqual([
      'instagram_business_basic',
      'instagram_business_manage_messages',
    ])
    expect(JSON.stringify(args.p_credential_metadata)).not.toContain('long-lived-token')
  })

  it('returns only the browser-safe connection summary', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: '50000000-0000-4000-8000-000000000001',
        status: 'connected',
        username: 'venue_account',
        account_type: 'creator',
        rollout_enabled: false,
        connected_at: '2026-09-21T10:00:00.000Z',
        token_expires_at: '2026-11-20T10:00:00.000Z',
        updated_at: '2026-09-21T10:00:00.000Z',
      },
      error: null,
    })

    await expect(getInstagramConnectionSummary({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
    })).resolves.toMatchObject({ username: 'venue_account', rollout_enabled: false })
  })

  it('accepts PostgreSQL timestamps with an explicit UTC offset', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: '50000000-0000-4000-8000-000000000001',
        status: 'connected',
        username: 'venue_account',
        account_type: 'creator',
        rollout_enabled: false,
        connected_at: '2026-09-22T08:05:56.123+00:00',
        token_expires_at: '2026-11-20T10:00:00.000+00:00',
        updated_at: '2026-09-22T08:05:56.123+00:00',
      },
      error: null,
    })

    await expect(getInstagramConnectionSummary({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
    })).resolves.toMatchObject({ username: 'venue_account', rollout_enabled: false })
  })

  it('removes the provider subscription before disabling the local connection', async () => {
    const calls: string[] = []
    const input = {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      connectionId: '50000000-0000-4000-8000-000000000001',
    }
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push(name)
      if (name === 'get_instagram_connection_disconnect_context') {
        return {
          data: {
            id: input.connectionId,
            credential_metadata: { encrypted_credentials: { ciphertext: 'encrypted' } },
          },
          error: null,
        }
      }
      expect(args).toMatchObject({
        p_provider_revoked: true,
        p_provider_error_code: null,
      })
      return { data: input.connectionId, error: null }
    })

    const result = await disconnectInstagramConnection({ rpc } as never, input, {
      decryptCredentials: () => ({
        accessToken: 'long-lived-token',
        expiresAt: '2026-11-20T10:00:00.000Z',
      }),
      unsubscribeWebhooks: async (accessToken) => {
        expect(accessToken).toBe('long-lived-token')
        calls.push('unsubscribe')
      },
    })

    expect(calls).toEqual([
      'get_instagram_connection_disconnect_context',
      'unsubscribe',
      'disconnect_instagram_connection',
    ])
    expect(result).toEqual({ disconnected: true, providerWarning: false })
  })

  it('still disconnects locally when Meta cannot remove the subscription', async () => {
    const input = {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      connectionId: '50000000-0000-4000-8000-000000000001',
    }
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === 'get_instagram_connection_disconnect_context') {
        return {
          data: {
            id: input.connectionId,
            credential_metadata: { encrypted_credentials: { ciphertext: 'encrypted' } },
          },
          error: null,
        }
      }
      expect(args).toMatchObject({
        p_provider_revoked: false,
        p_provider_error_code: 'instagram_webhook_unsubscription_unavailable',
      })
      return { data: input.connectionId, error: null }
    })

    await expect(disconnectInstagramConnection({ rpc } as never, input, {
      decryptCredentials: () => ({
        accessToken: 'long-lived-token',
        expiresAt: '2026-11-20T10:00:00.000Z',
      }),
      unsubscribeWebhooks: async () => {
        throw new Error('instagram_webhook_unsubscription_http_403')
      },
    })).resolves.toEqual({ disconnected: true, providerWarning: true })
  })
})
