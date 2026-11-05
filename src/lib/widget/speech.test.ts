import { describe, expect, it } from 'vitest'
import {
  MAX_SPEECH_AUDIO_BYTES,
  getPublicVoiceConfig,
  getTranscriptionLanguageHint,
  isAllowedAudioMimeType,
  parseTranscriptionForm,
  speechSynthesisRequestSchema,
} from './speech'

function audioForm(audio: Blob | null, fields: Record<string, string> = { session_id: 'session-1' }) {
  const form = new FormData()
  if (audio) form.append('audio', audio, 'speech')
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return form
}

describe('widget speech validation', () => {
  it('accepts browser recorder formats including codec parameters', () => {
    expect(isAllowedAudioMimeType('audio/webm;codecs=opus')).toBe(true)
    expect(isAllowedAudioMimeType('audio/mp4')).toBe(true)
    expect(isAllowedAudioMimeType('video/webm')).toBe(false)
    expect(isAllowedAudioMimeType('text/plain')).toBe(false)
  })

  it('parses a valid transcription upload and picks a file extension OpenAI recognises', () => {
    const result = parseTranscriptionForm(audioForm(
      new Blob(['abc'], { type: 'audio/webm;codecs=opus' }),
      { session_id: 'session-1', page_url: 'https://venue.example/agenda', language: 'pt-BR' },
    ))

    expect(result).toMatchObject({
      ok: true,
      value: {
        sessionId: 'session-1',
        mimeType: 'audio/webm',
        fileName: 'speech.webm',
        language: 'pt',
        pageUrl: 'https://venue.example/agenda',
      },
    })
  })

  it('rejects missing, empty, oversized and non-audio uploads', () => {
    expect(parseTranscriptionForm(audioForm(null))).toMatchObject({ ok: false, status: 400 })
    expect(parseTranscriptionForm(audioForm(new Blob([], { type: 'audio/webm' })))).toMatchObject({ ok: false, status: 400 })
    expect(parseTranscriptionForm(audioForm(
      new Blob([new Uint8Array(MAX_SPEECH_AUDIO_BYTES + 1)], { type: 'audio/webm' }),
    ))).toMatchObject({ ok: false, status: 413 })
    expect(parseTranscriptionForm(audioForm(new Blob(['x'], { type: 'image/png' })))).toMatchObject({ ok: false, status: 415 })
  })

  it('requires a session id for usage attribution', () => {
    expect(parseTranscriptionForm(audioForm(new Blob(['x'], { type: 'audio/webm' }), {})))
      .toMatchObject({ ok: false, status: 400, error: 'session_id is required' })
  })

  it('only forwards two-letter language hints', () => {
    expect(getTranscriptionLanguageHint('es-ES')).toBe('es')
    expect(getTranscriptionLanguageHint('ca')).toBe('ca')
    expect(getTranscriptionLanguageHint('not a language')).toBeNull()
    expect(getTranscriptionLanguageHint(null)).toBeNull()
  })

  it('caps synthesized text so a single request stays cheap', () => {
    expect(speechSynthesisRequestSchema.safeParse({ session_id: 's', text: 'Hola' }).success).toBe(true)
    expect(speechSynthesisRequestSchema.safeParse({ session_id: 's', text: 'a'.repeat(1201) }).success).toBe(false)
    expect(speechSynthesisRequestSchema.safeParse({ session_id: 's', text: '   ' }).success).toBe(false)
  })

  it('normalizes MIME aliases to the types talia-ai accepts', () => {
    const result = parseTranscriptionForm(audioForm(new Blob(['x'], { type: 'audio/x-wav' })))
    expect(result).toMatchObject({ ok: true, value: { mimeType: 'audio/wav', fileName: 'speech.wav' } })
  })

  it('defaults speech pace to normal and accepts the slow pace', () => {
    expect(speechSynthesisRequestSchema.parse({ session_id: 's', text: 'Hola' }).pace).toBe('normal')
    expect(speechSynthesisRequestSchema.parse({ session_id: 's', text: 'Hola', pace: 'slow' }).pace).toBe('slow')
    expect(speechSynthesisRequestSchema.safeParse({ session_id: 's', text: 'Hola', pace: 'fast' }).success).toBe(false)
  })

  it('reports TALIA voice only when talia-ai is configured and the kill switch is not set', () => {
    const taliaAi = { TALIA_AI_BASE_URL: 'https://talia-ai.example', TALIA_AI_INTERNAL_API_KEY: 'internal-key' }
    expect(getPublicVoiceConfig(taliaAi)).toEqual({ provider: 'talia' })
    expect(getPublicVoiceConfig({})).toEqual({ provider: 'browser' })
    expect(getPublicVoiceConfig({ OPENAI_API_KEY: 'sk-test' })).toEqual({ provider: 'browser' })
    expect(getPublicVoiceConfig({ ...taliaAi, WIDGET_SERVER_VOICE_ENABLED: 'false' })).toEqual({ provider: 'browser' })
  })
})
