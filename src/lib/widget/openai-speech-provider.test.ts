import { describe, expect, it, vi } from 'vitest'
import { OpenAISpeechProvider, createSpeechProviderFromEnv } from './openai-speech-provider'

describe('OpenAISpeechProvider', () => {
  it('sends audio to the transcription endpoint and returns the text with usage', async () => {
    const fetcher = vi.fn(async () => Response.json({
      text: ' ¿A qué hora abrís? ',
      usage: { type: 'tokens', input_tokens: 42, output_tokens: 7 },
    }))
    const provider = new OpenAISpeechProvider('sk-test', { baseUrl: 'https://eu.api.openai.com/v1/', fetcher })

    const result = await provider.transcribe({
      audio: new Blob(['audio'], { type: 'audio/webm' }),
      fileName: 'speech.webm',
      language: 'es',
    })

    expect(result).toEqual({
      ok: true,
      text: '¿A qué hora abrís?',
      model: 'gpt-4o-mini-transcribe',
      usage: { inputTokens: 42, outputTokens: 7, audioSeconds: null },
    })
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://eu.api.openai.com/v1/audio/transcriptions')
    expect(init.headers).toEqual({ Authorization: 'Bearer sk-test' })
    const body = init.body as FormData
    expect(body.get('model')).toBe('gpt-4o-mini-transcribe')
    expect(body.get('language')).toBe('es')
    expect((body.get('file') as File).name).toBe('speech.webm')
  })

  it('omits the language hint so OpenAI can auto-detect it', async () => {
    const fetcher = vi.fn(async () => Response.json({ text: 'Hello' }))
    const provider = new OpenAISpeechProvider('sk-test', { fetcher })

    await provider.transcribe({ audio: new Blob(['a'], { type: 'audio/webm' }), fileName: 'speech.webm', language: null })

    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.body as FormData).has('language')).toBe(false)
  })

  it('reports transcription failures without throwing', async () => {
    const provider = new OpenAISpeechProvider('sk-test', {
      fetcher: vi.fn(async () => Response.json({ error: { message: 'bad' } }, { status: 500 })),
    })
    await expect(provider.transcribe({ audio: new Blob(['a']), fileName: 'speech.webm', language: null }))
      .resolves.toEqual({ ok: false, error: 'OpenAI responded with 500', status: 500 })

    const offline = new OpenAISpeechProvider('sk-test', { fetcher: vi.fn(async () => { throw new Error('offline') }) })
    await expect(offline.transcribe({ audio: new Blob(['a']), fileName: 'speech.webm', language: null }))
      .resolves.toEqual({ ok: false, error: 'OpenAI transcription request failed' })
  })

  it('requests mp3 speech with venue delivery instructions', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }))
    const provider = new OpenAISpeechProvider('sk-test', { fetcher, ttsVoice: 'sage' })

    const result = await provider.synthesize({ text: 'Abrimos a las 18:00.', language: 'es-ES' })

    expect(result).toMatchObject({ ok: true, contentType: 'audio/mpeg', model: 'gpt-4o-mini-tts', voice: 'sage' })
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/audio/speech')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'sage', input: 'Abrimos a las 18:00.', response_format: 'mp3' })
    expect(body.instructions).toContain('Spanish')
  })

  it('reports speech failures without throwing', async () => {
    const provider = new OpenAISpeechProvider('sk-test', {
      fetcher: vi.fn(async () => new Response('nope', { status: 429 })),
    })
    await expect(provider.synthesize({ text: 'Hola', language: 'es' }))
      .resolves.toEqual({ ok: false, error: 'OpenAI responded with 429', status: 429 })
  })

  it('is only created when OpenAI voice is configured', () => {
    expect(createSpeechProviderFromEnv({})).toBeNull()
    expect(createSpeechProviderFromEnv({ OPENAI_API_KEY: 'sk', WIDGET_OPENAI_VOICE_ENABLED: 'false' })).toBeNull()
    expect(createSpeechProviderFromEnv({ OPENAI_API_KEY: 'sk' })).toBeInstanceOf(OpenAISpeechProvider)
  })
})
