import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeRateLimit } from '@/lib/auth/security'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { checkTenantLimit, recordUsageEvent } from '@/lib/usage/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { createSpeechProviderFromEnv, type SpeechProvider } from '@/lib/widget/talia-ai-speech-provider'
import { POST } from './route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/auth/security', () => ({ consumeRateLimit: vi.fn(), getClientIp: vi.fn(() => '203.0.113.7') }))
vi.mock('@/lib/tenants/service', () => ({ getTenantChatConfig: vi.fn() }))
vi.mock('@/lib/usage/service', () => ({ checkTenantLimit: vi.fn(), recordUsageEvent: vi.fn() }))
vi.mock('@/lib/usage/ai-cost', () => ({ recordMeasuredAiUsage: vi.fn() }))
vi.mock('@/lib/widget/domain-allowlist', () => ({
  getTenantWidgetDomainSettings: vi.fn(),
  validateWidgetRequestDomain: vi.fn(),
}))
vi.mock('@/lib/widget/talia-ai-speech-provider', () => ({ createSpeechProviderFromEnv: vi.fn() }))

const provider = {
  transcribe: vi.fn(),
  synthesize: vi.fn(),
} satisfies SpeechProvider

function speechRequest(body: unknown) {
  return POST(
    new Request('https://agora.talia.events/api/chat/tenant-1/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ tenantId: 'tenant-1' }) },
  )
}

describe('POST /api/chat/[tenantId]/speech', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSpeechProviderFromEnv).mockReturnValue(provider)
    vi.mocked(consumeRateLimit).mockResolvedValue(null)
    vi.mocked(getTenantChatConfig).mockResolvedValue({ ok: true, config: {} } as Awaited<ReturnType<typeof getTenantChatConfig>>)
    vi.mocked(getTenantWidgetDomainSettings).mockResolvedValue({
      ok: true,
      settings: { websiteUrl: 'https://venue.example', widgetConfig: {} },
    })
    vi.mocked(validateWidgetRequestDomain).mockReturnValue({
      ok: true,
      requestHost: 'venue.example',
      pageHost: 'venue.example',
      authorizedHosts: ['venue.example'],
    })
    vi.mocked(checkTenantLimit).mockResolvedValue({ ok: true, allowed: true } as Awaited<ReturnType<typeof checkTenantLimit>>)
    vi.mocked(recordUsageEvent).mockResolvedValue({ ok: true, duplicate: false, eventId: 'usage-event-1' } as Awaited<ReturnType<typeof recordUsageEvent>>)
    vi.mocked(recordMeasuredAiUsage).mockResolvedValue({ ok: true, inserted: 1 })
    provider.synthesize.mockResolvedValue({
      ok: true,
      audio: new Uint8Array([7, 8, 9]),
      contentType: 'audio/mpeg',
      voice: 'coral',
      usageComponents: [{
        component: 'text_to_speech',
        provider: 'openai',
        model: 'gpt-4o-mini-tts',
        request_count: 1,
        input_tokens: 12,
        cached_input_tokens: 0,
        output_tokens: 240,
      }],
    })
  })

  it('returns playable, uncached audio and records the AI call', async () => {
    const response = await speechRequest({ session_id: 'session-1', text: 'Abrimos a las 18:00.', language: 'es-ES' })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([7, 8, 9]))
    expect(provider.synthesize).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      text: 'Abrimos a las 18:00.',
      language: 'es-ES',
      pace: 'normal',
      voice: 'coral',
    })
    expect(recordUsageEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventType: 'ai_call',
      inputTokens: 12,
      outputTokens: 240,
      metadata: expect.objectContaining({ component: 'text_to_speech', characters: 20, voice: 'coral', pace: 'normal' }),
    }))
    expect(recordMeasuredAiUsage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ usageEventId: 'usage-event-1' }))
  })

  it('forwards the slow pace for the "slower" voice command', async () => {
    await speechRequest({ session_id: 'session-1', text: 'Hola', pace: 'slow' })

    expect(provider.synthesize).toHaveBeenCalledWith(expect.objectContaining({ pace: 'slow' }))
  })

  it('speaks with the voice the venue chose in Agora', async () => {
    vi.mocked(getTenantChatConfig).mockResolvedValue({ ok: true, config: { agentVoice: 'ash' } } as Awaited<ReturnType<typeof getTenantChatConfig>>)

    await speechRequest({ session_id: 'session-1', text: 'Hola' })

    expect(provider.synthesize).toHaveBeenCalledWith(expect.objectContaining({ voice: 'ash' }))
  })

  it('rejects text above the per-request cap', async () => {
    const response = await speechRequest({ session_id: 'session-1', text: 'a'.repeat(1201) })

    expect(response.status).toBe(400)
    expect(createSpeechProviderFromEnv).not.toHaveBeenCalled()
  })

  it('uses its own rate-limit bucket', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({ unavailable: true, retryAfterSeconds: 0 } as Awaited<ReturnType<typeof consumeRateLimit>>)

    const response = await speechRequest({ session_id: 'session-1', text: 'Hola' })

    expect(response.status).toBe(503)
    expect(vi.mocked(consumeRateLimit).mock.calls[0][0][0].key).toBe('voice-speech-minute:tenant-1:203.0.113.7')
    expect(provider.synthesize).not.toHaveBeenCalled()
  })

  it('returns a generic error and records nothing when talia-ai fails', async () => {
    provider.synthesize.mockResolvedValue({ ok: false, error: 'talia-ai responded with 502', status: 502 })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const response = await speechRequest({ session_id: 'session-1', text: 'Hola' })

    expect(response.status).toBe(502)
    expect(recordUsageEvent).not.toHaveBeenCalled()
  })
})
