import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeRateLimit } from '@/lib/auth/security'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import { createSpeechProviderFromEnv, type SpeechProvider } from '@/lib/widget/talia-ai-speech-provider'
import { recordVoiceUsage } from '@/lib/widget/voice-request-guard'
import { previewAgentVoice } from './preview-agent-voice-action'

vi.mock('@/lib/auth/tenant-access', () => ({ requireTenantProductAccess: vi.fn() }))
vi.mock('@/lib/auth/security', () => ({ consumeRateLimit: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { primary_language: 'ca' } }) }) }) }),
  })),
}))
vi.mock('@/lib/tenants/service', () => ({ assertTenantAdmin: vi.fn() }))
vi.mock('@/lib/widget/talia-ai-speech-provider', () => ({ createSpeechProviderFromEnv: vi.fn() }))
vi.mock('@/lib/widget/voice-request-guard', () => ({ recordVoiceUsage: vi.fn() }))

const provider = { transcribe: vi.fn(), synthesize: vi.fn() } satisfies SpeechProvider

describe('previewAgentVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireTenantProductAccess).mockResolvedValue({} as Awaited<ReturnType<typeof requireTenantProductAccess>>)
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(assertTenantAdmin).mockResolvedValue(true)
    vi.mocked(consumeRateLimit).mockResolvedValue(null)
    vi.mocked(createSpeechProviderFromEnv).mockReturnValue(provider)
    provider.synthesize.mockResolvedValue({
      ok: true,
      audio: new Uint8Array([1, 2, 3]),
      contentType: 'audio/mpeg',
      voice: 'sage',
      usageComponents: [],
    })
  })

  it('plays a sample in the venue language with the chosen voice and records usage', async () => {
    const result = await previewAgentVoice('tenant-1', 'sage')

    expect(result).toEqual({ ok: true, audioBase64: Buffer.from([1, 2, 3]).toString('base64') })
    expect(requireTenantProductAccess).toHaveBeenCalledWith('tenant-1', 'manage_chatbot', 'web')
    expect(provider.synthesize).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', voice: 'sage', language: 'ca' }))
    expect(vi.mocked(consumeRateLimit).mock.calls[0][0][0].key).toBe('voice-preview:tenant-1:user-1')
    expect(recordVoiceUsage).toHaveBeenCalled()
  })

  it('refuses non-admin members', async () => {
    vi.mocked(assertTenantAdmin).mockResolvedValue(false)

    await expect(previewAgentVoice('tenant-1', 'sage')).resolves.toEqual({ ok: false, error: 'forbidden' })
    expect(provider.synthesize).not.toHaveBeenCalled()
  })

  it('rejects unknown voices before spending anything', async () => {
    await expect(previewAgentVoice('tenant-1', 'robot')).resolves.toEqual({ ok: false, error: 'invalid_voice' })
    expect(consumeRateLimit).not.toHaveBeenCalled()
    expect(provider.synthesize).not.toHaveBeenCalled()
  })

  it('is rate limited per user', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({ unavailable: false, retryAfterSeconds: 30 } as Awaited<ReturnType<typeof consumeRateLimit>>)

    await expect(previewAgentVoice('tenant-1', 'sage')).resolves.toEqual({ ok: false, error: 'rate_limited' })
    expect(provider.synthesize).not.toHaveBeenCalled()
  })
})
