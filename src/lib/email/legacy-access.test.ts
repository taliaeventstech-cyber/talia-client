import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasEmailAgentPreviewAccess, isLegacyEmailAgentAccount } from './legacy-access'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

const createAdminClientMock = vi.mocked(createAdminClient)

describe('legacy email agent access', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows only the TALIA legacy account by default', () => {
    vi.stubEnv('LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS', '')

    expect(isLegacyEmailAgentAccount('talia.events.tech@gmail.com')).toBe(false)
    vi.unstubAllEnvs()
    expect(isLegacyEmailAgentAccount('talia.events.tech@gmail.com')).toBe(true)
    expect(isLegacyEmailAgentAccount('customer@example.com')).toBe(false)
  })

  it('normalizes configured email addresses', () => {
    vi.stubEnv('LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS', ' Legacy@Example.com, second@example.com ')

    expect(isLegacyEmailAgentAccount('legacy@example.com')).toBe(true)
    expect(isLegacyEmailAgentAccount('SECOND@example.com')).toBe(true)
    expect(isLegacyEmailAgentAccount('customer@example.com')).toBe(false)
  })

  it('allows an authorized tenant operator when Backstage configured an active canary mailbox', async () => {
    vi.stubEnv('LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS', 'legacy@example.com')
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'connection-id' }, error: null })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const neq = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockReturnValue({ neq })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    createAdminClientMock.mockReturnValue({ from } as never)

    await expect(hasEmailAgentPreviewAccess(
      'f69d6cf6-04e1-4ec1-84db-c3a3c0388229',
      'ricardo@talia.events',
    )).resolves.toBe(true)

    expect(from).toHaveBeenCalledWith('email_connections')
    expect(eq).toHaveBeenCalledWith('theatre_id', 'f69d6cf6-04e1-4ec1-84db-c3a3c0388229')
    expect(neq).toHaveBeenCalledWith('status', 'disabled')
    expect(limit).toHaveBeenCalledWith(1)
  })

  it('fails closed when the tenant has no configured canary mailbox', async () => {
    vi.stubEnv('LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS', 'legacy@example.com')
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const neq = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockReturnValue({ neq })
    const select = vi.fn().mockReturnValue({ eq })
    createAdminClientMock.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as never)

    await expect(hasEmailAgentPreviewAccess('tenant-without-canary', 'customer@example.com'))
      .resolves.toBe(false)
  })
})
