import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decryptWhatsappCredentials,
  encryptWhatsappCredentials,
  getWhatsappConnectionAccessToken,
} from './credentials'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('WhatsApp connection credentials', () => {
  it('encrypts and authenticates tenant credentials at rest', () => {
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))
    const credentials = {
      accessToken: 'tenant-business-token',
      twoStepPin: '472901',
      tokenType: 'bearer',
      expiresAt: '2026-10-18T10:00:00.000Z',
    }

    const encrypted = encryptWhatsappCredentials(credentials)

    expect(encrypted.ciphertext).not.toContain(credentials.accessToken)
    expect(decryptWhatsappCredentials(encrypted)).toEqual(credentials)
  })

  it('rejects a modified encrypted credential', () => {
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))
    const encrypted = encryptWhatsappCredentials({
      accessToken: 'tenant-business-token',
      twoStepPin: '472901',
    })

    expect(() => decryptWhatsappCredentials({ ...encrypted, tag: 'broken' })).toThrow()
  })

  it('keeps the pilot environment token compatible', async () => {
    vi.stubEnv('META_WHATSAPP_ACCESS_TOKEN', 'pilot-token')
    const rpc = vi.fn().mockResolvedValue({
      data: { credential_source: 'environment', credential_metadata: {} },
      error: null,
    })

    await expect(getWhatsappConnectionAccessToken({ rpc } as never, {
      tenantId: 'tenant-id',
      phoneNumberId: 'phone-id',
    })).resolves.toBe('pilot-token')
  })

  it('loads and decrypts a tenant-specific token', async () => {
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'w'.repeat(32))
    const encrypted = encryptWhatsappCredentials({
      accessToken: 'tenant-token',
      twoStepPin: '472901',
    })
    const rpc = vi.fn().mockResolvedValue({
      data: {
        credential_source: 'encrypted',
        credential_metadata: { encrypted_credentials: encrypted },
      },
      error: null,
    })

    await expect(getWhatsappConnectionAccessToken({ rpc } as never, {
      tenantId: 'tenant-id',
      phoneNumberId: 'phone-id',
    })).resolves.toBe('tenant-token')
  })
})
