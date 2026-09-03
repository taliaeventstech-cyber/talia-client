import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeWhatsappEmbeddedSignup, disconnectWhatsappConnection } from './connection-service'
import { MetaEmbeddedSignupError } from './embedded-signup'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('WhatsApp Embedded Signup completion', () => {
  it('persists encrypted credentials before provider side effects and then connects', async () => {
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))
    const calls: string[] = []
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      calls.push(`save:${String(args.p_status)}`)
      expect(JSON.stringify(args.p_credential_metadata)).not.toContain('business-token')
      return { data: '50000000-0000-4000-8000-000000000001', error: null }
    })

    const result = await completeWhatsappEmbeddedSignup({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      code: 'single-use-code',
      businessId: 'business-1',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    }, {
      exchangeCode: async () => ({ access_token: 'business-token', token_type: 'bearer', expires_in: 60 }),
      getPhone: async () => ({ id: 'phone-1', display_phone_number: '+34 600 000 000', verified_name: 'Sala' }),
      subscribeApp: async () => { calls.push('subscribe') },
      registerPhone: async () => { calls.push('register') },
      createPin: () => '472901',
      now: () => Date.parse('2026-08-19T12:00:00.000Z'),
    })

    expect(calls).toEqual(['save:draft', 'subscribe', 'register', 'save:connected'])
    expect(result.displayPhoneNumber).toBe('+34 600 000 000')
  })

  it('retains the encrypted token in an error state when registration fails', async () => {
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))
    const statuses: string[] = []
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      statuses.push(String(args.p_status))
      return { data: '50000000-0000-4000-8000-000000000001', error: null }
    })

    await expect(completeWhatsappEmbeddedSignup({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      code: 'single-use-code',
      businessId: 'business-1',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    }, {
      exchangeCode: async () => ({ access_token: 'business-token' }),
      getPhone: async () => ({ id: 'phone-1' }),
      subscribeApp: async () => undefined,
      registerPhone: async () => { throw new MetaEmbeddedSignupError('meta_phone_registration_http_400', 400) },
      createPin: () => '472901',
    })).rejects.toThrow('meta_phone_registration_http_400')

    expect(statuses).toEqual(['draft', 'error'])
  })

  it('treats the connection as successful when Meta confirms the phone connected after registration failed', async () => {
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))
    const statuses: string[] = []
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      statuses.push(String(args.p_status))
      return { data: '50000000-0000-4000-8000-000000000001', error: null }
    })
    const getPhone = vi.fn()
      .mockResolvedValueOnce({
        id: 'phone-1',
        display_phone_number: '+1 555-336-9296',
        verified_name: 'Boostbox',
        status: 'PENDING',
      })
      .mockResolvedValueOnce({
        id: 'phone-1',
        display_phone_number: '+1 555-336-9296',
        verified_name: 'Boostbox',
        status: 'CONNECTED',
      })

    const result = await completeWhatsappEmbeddedSignup({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      code: 'single-use-code',
      businessId: 'business-1',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    }, {
      exchangeCode: async () => ({ access_token: 'business-token' }),
      getPhone,
      subscribeApp: async () => undefined,
      registerPhone: async () => {
        throw new MetaEmbeddedSignupError('meta_phone_registration_http_400', 400)
      },
      createPin: () => '472901',
    })

    expect(getPhone).toHaveBeenCalledTimes(2)
    expect(statuses).toEqual(['draft', 'connected'])
    expect(result.displayPhoneNumber).toBe('+1 555-336-9296')
  })

  it('does not register a phone that Embedded Signup already connected', async () => {
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))
    const statuses: string[] = []
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      statuses.push(String(args.p_status))
      return { data: '50000000-0000-4000-8000-000000000001', error: null }
    })
    const registerPhone = vi.fn()

    await completeWhatsappEmbeddedSignup({ rpc } as never, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      code: 'single-use-code',
      businessId: 'business-1',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    }, {
      exchangeCode: async () => ({ access_token: 'business-token' }),
      getPhone: async () => ({
        id: 'phone-1',
        display_phone_number: '+1 555-336-9296',
        verified_name: 'Boostbox',
        status: 'CONNECTED',
      }),
      subscribeApp: async () => undefined,
      registerPhone,
      createPin: () => '472901',
    })

    expect(registerPhone).not.toHaveBeenCalled()
    expect(statuses).toEqual(['draft', 'connected'])
  })
})

describe('WhatsApp connection disconnection', () => {
  const input = {
    tenantId: '10000000-0000-4000-8000-000000000001',
    actorUserId: '20000000-0000-4000-8000-000000000001',
    connectionId: '50000000-0000-4000-8000-000000000001',
  }

  it('unsubscribes Meta before clearing the local credentials', async () => {
    const calls: string[] = []
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push(name)
      if (name === 'get_whatsapp_connection_disconnect_context') {
        return {
          data: {
            id: input.connectionId,
            waba_id: 'waba-1',
            credential_metadata: { encrypted_credentials: { ciphertext: 'encrypted' } },
            can_unsubscribe_provider: true,
          },
          error: null,
        }
      }
      expect(args).toMatchObject({
        p_connection_id: input.connectionId,
        p_provider_unsubscribed: true,
        p_provider_error_code: null,
      })
      return { data: input.connectionId, error: null }
    })

    const result = await disconnectWhatsappConnection({ rpc } as never, input, {
      decryptCredentials: () => ({ accessToken: 'business-token', twoStepPin: '472901' }),
      unsubscribeApp: async ({ wabaId, accessToken }) => {
        calls.push('unsubscribe')
        expect({ wabaId, accessToken }).toEqual({ wabaId: 'waba-1', accessToken: 'business-token' })
      },
    })

    expect(calls).toEqual([
      'get_whatsapp_connection_disconnect_context',
      'unsubscribe',
      'disconnect_whatsapp_connection',
    ])
    expect(result).toEqual({ disconnected: true, providerWarning: false })
  })

  it('still disconnects locally when Meta cannot remove the subscription', async () => {
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === 'get_whatsapp_connection_disconnect_context') {
        return {
          data: {
            id: input.connectionId,
            waba_id: 'waba-1',
            credential_metadata: { encrypted_credentials: { ciphertext: 'encrypted' } },
            can_unsubscribe_provider: true,
          },
          error: null,
        }
      }
      expect(args).toMatchObject({
        p_provider_unsubscribed: false,
        p_provider_error_code: 'meta_waba_unsubscription_http_403',
      })
      return { data: input.connectionId, error: null }
    })

    const result = await disconnectWhatsappConnection({ rpc } as never, input, {
      decryptCredentials: () => ({ accessToken: 'business-token', twoStepPin: '472901' }),
      unsubscribeApp: async () => {
        throw new MetaEmbeddedSignupError('meta_waba_unsubscription_http_403', 403)
      },
    })

    expect(result).toEqual({ disconnected: true, providerWarning: true })
    expect(rpc).toHaveBeenLastCalledWith('disconnect_whatsapp_connection', expect.any(Object))
  })
})
