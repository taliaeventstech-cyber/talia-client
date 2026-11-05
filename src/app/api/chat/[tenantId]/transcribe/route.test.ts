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

const sttComponent = {
  component: 'speech_to_text' as const,
  provider: 'openai',
  model: 'gpt-4o-mini-transcribe',
  request_count: 1,
  input_tokens: 30,
  cached_input_tokens: 0,
  output_tokens: 8,
}

const provider = {
  transcribe: vi.fn(),
  synthesize: vi.fn(),
} satisfies SpeechProvider

function transcribeRequest(audio: Blob = new Blob(['audio'], { type: 'audio/webm;codecs=opus' })) {
  const form = new FormData()
  form.append('audio', audio, 'speech')
  form.append('session_id', 'session-1')
  form.append('page_url', 'https://venue.example/agenda')
  return POST(
    new Request('https://agora.talia.events/api/chat/tenant-1/transcribe', { method: 'POST', body: form }),
    { params: Promise.resolve({ tenantId: 'tenant-1' }) },
  )
}

describe('POST /api/chat/[tenantId]/transcribe', () => {
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
    provider.transcribe.mockResolvedValue({
      ok: true,
      text: '¿Cuánto cuesta la entrada?',
      usageComponents: [sttComponent],
    })
  })

  it('transcribes the audio and records the AI call against the venue', async () => {
    const response = await transcribeRequest()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ text: '¿Cuánto cuesta la entrada?' })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(provider.transcribe).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', sessionId: 'session-1', mimeType: 'audio/webm', language: null }))
    expect(validateWidgetRequestDomain).toHaveBeenCalledWith(expect.objectContaining({ pageUrl: 'https://venue.example/agenda' }))
    expect(recordUsageEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-1',
      moduleKey: 'web',
      channel: 'web',
      eventType: 'ai_call',
      unit: 'call',
      inputTokens: 30,
      outputTokens: 8,
      idempotencyKey: expect.stringMatching(/^voice:tenant-1:.+:ai_call$/),
      metadata: expect.objectContaining({ component: 'speech_to_text', accuracy: 'measured', session_id: 'session-1' }),
    }))
    expect(recordMeasuredAiUsage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      usageEventId: 'usage-event-1',
      components: [sttComponent],
    }))
  })

  it('tells the widget to use browser voice when talia-ai voice is not configured', async () => {
    vi.mocked(createSpeechProviderFromEnv).mockReturnValue(null)

    const response = await transcribeRequest()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'voice_unavailable' })
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })

  it('rate limits per venue and visitor before touching the database', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({ unavailable: false, retryAfterSeconds: 42 } as Awaited<ReturnType<typeof consumeRateLimit>>)

    const response = await transcribeRequest()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(vi.mocked(consumeRateLimit).mock.calls[0][0][0].key).toBe('voice-transcribe-minute:tenant-1:203.0.113.7')
    expect(getTenantChatConfig).not.toHaveBeenCalled()
    expect(provider.transcribe).not.toHaveBeenCalled()
  })

  it('rejects disabled or inactive venues', async () => {
    vi.mocked(getTenantChatConfig).mockResolvedValue({ ok: false, error: 'Chatbot is disabled' } as Awaited<ReturnType<typeof getTenantChatConfig>>)

    const response = await transcribeRequest()

    expect(response.status).toBe(404)
    expect(provider.transcribe).not.toHaveBeenCalled()
  })

  it('rejects requests from domains the venue has not authorised', async () => {
    vi.mocked(validateWidgetRequestDomain).mockReturnValue({
      ok: false,
      error: 'domain_not_allowed',
      requestHost: 'evil.example',
      pageHost: null,
      authorizedHosts: ['venue.example'],
    })

    const response = await transcribeRequest()

    expect(response.status).toBe(403)
    expect(provider.transcribe).not.toHaveBeenCalled()
  })

  it('skips the paid call once the venue usage limit blocks answers', async () => {
    vi.mocked(checkTenantLimit).mockResolvedValue({ ok: true, allowed: false } as Awaited<ReturnType<typeof checkTenantLimit>>)

    const response = await transcribeRequest()

    expect(response.status).toBe(402)
    expect(provider.transcribe).not.toHaveBeenCalled()
  })

  it('rejects non-audio uploads before any guard runs', async () => {
    const response = await transcribeRequest(new Blob(['<svg/>'], { type: 'image/svg+xml' }))

    expect(response.status).toBe(415)
    expect(createSpeechProviderFromEnv).not.toHaveBeenCalled()
  })

  it('returns a generic error and records nothing when talia-ai fails', async () => {
    provider.transcribe.mockResolvedValue({ ok: false, error: 'talia-ai responded with 502', status: 502 })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const response = await transcribeRequest()

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'transcription_failed' })
    expect(recordUsageEvent).not.toHaveBeenCalled()
  })
})
