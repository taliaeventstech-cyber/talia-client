import { describe, expect, it, vi } from 'vitest'
import { TaliaAiSpeechProvider, createSpeechProviderFromEnv } from './talia-ai-speech-provider'

const usage = (component: 'speech_to_text' | 'text_to_speech') => ({
  component,
  provider: 'openai',
  model: component === 'speech_to_text' ? 'gpt-4o-mini-transcribe' : 'gpt-4o-mini-tts',
  request_count: 1,
  input_tokens: 10,
  cached_input_tokens: 0,
  output_tokens: 20,
})

function provider(fetcher: typeof fetch) {
  return new TaliaAiSpeechProvider('https://talia-ai.example', 'internal-key', fetcher)
}

describe('TaliaAiSpeechProvider', () => {
  it('sends audio to talia-ai as base64 with internal auth and returns usage components', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      ok: true,
      text: ' ¿A qué hora abrís? ',
      usage_components: [usage('speech_to_text')],
      metadata: { audio_bytes: 5 },
    }))

    const result = await provider(fetcher).transcribe({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      audio: new Blob(['audio'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      language: null,
    })

    expect(result).toEqual({ ok: true, text: '¿A qué hora abrís?', usageComponents: [usage('speech_to_text')] })
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://talia-ai.example/v1/voice/transcribe')
    expect(init?.headers).toEqual({ Authorization: 'Bearer internal-key', 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({
      tenant_id: 'tenant-1',
      session_id: 'session-1',
      audio_base64: Buffer.from('audio').toString('base64'),
      mime_type: 'audio/webm',
    })
  })

  it('decodes speech audio and forwards pace and language', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      ok: true,
      audio_base64: Buffer.from('mp3').toString('base64'),
      content_type: 'audio/mpeg',
      usage_components: [usage('text_to_speech')],
      metadata: { voice: 'coral', pace: 'slow', characters: 4, audio_bytes: 3 },
    }))

    const result = await provider(fetcher).synthesize({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      text: 'Hola',
      language: 'es-ES',
      pace: 'slow',
    })

    expect(result).toMatchObject({ ok: true, contentType: 'audio/mpeg', voice: 'coral', usageComponents: [usage('text_to_speech')] })
    expect(result.ok && Buffer.from(result.audio).toString()).toBe('mp3')
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      tenant_id: 'tenant-1',
      session_id: 'session-1',
      text: 'Hola',
      pace: 'slow',
      language: 'es-ES',
    })
  })

  it('reports talia-ai errors and malformed responses without throwing', async () => {
    const failing = provider(vi.fn<typeof fetch>(async () => Response.json({ ok: false, error: 'model_unavailable' }, { status: 503 })))
    await expect(failing.synthesize({ tenantId: 't', sessionId: 's', text: 'Hola', language: null, pace: 'normal' }))
      .resolves.toEqual({ ok: false, error: 'talia-ai responded with 503', status: 503 })

    const malformed = provider(vi.fn<typeof fetch>(async () => Response.json({ ok: true, text: 42 })))
    await expect(malformed.transcribe({ tenantId: 't', sessionId: 's', audio: new Blob(['a']), mimeType: 'audio/webm', language: null }))
      .resolves.toEqual({ ok: false, error: 'talia-ai returned an invalid transcription' })

    const offline = provider(vi.fn<typeof fetch>(async () => { throw new Error('offline') }))
    await expect(offline.synthesize({ tenantId: 't', sessionId: 's', text: 'Hola', language: null, pace: 'normal' }))
      .resolves.toEqual({ ok: false, error: 'talia-ai voice request failed' })
  })

  it('is only created when talia-ai is configured and voice is not switched off', () => {
    const env = { TALIA_AI_BASE_URL: 'https://talia-ai.example/', TALIA_AI_INTERNAL_API_KEY: 'k' }
    expect(createSpeechProviderFromEnv({})).toBeNull()
    expect(createSpeechProviderFromEnv({ ...env, WIDGET_SERVER_VOICE_ENABLED: 'false' })).toBeNull()
    expect(createSpeechProviderFromEnv(env)).toBeInstanceOf(TaliaAiSpeechProvider)
  })
})
