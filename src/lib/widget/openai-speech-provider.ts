import { buildSpeechInstructions, isServerSpeechConfigured } from './speech'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe'
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts'
const DEFAULT_TTS_VOICE = 'coral'
const REQUEST_TIMEOUT_MS = 20_000

export type SpeechUsage = {
  inputTokens: number
  outputTokens: number
  audioSeconds: number | null
}

export type TranscriptionResult =
  | { ok: true; text: string; model: string; usage: SpeechUsage }
  | { ok: false; error: string; status?: number }

export type SynthesisResult =
  | { ok: true; audio: ArrayBuffer; contentType: string; model: string; voice: string }
  | { ok: false; error: string; status?: number }

export interface SpeechProvider {
  transcribe(input: { audio: Blob; fileName: string; language: string | null }): Promise<TranscriptionResult>
  synthesize(input: { text: string; language: string | null }): Promise<SynthesisResult>
}

export class OpenAISpeechProvider implements SpeechProvider {
  constructor(
    private readonly apiKey: string,
    private readonly options: {
      baseUrl?: string
      transcribeModel?: string
      ttsModel?: string
      ttsVoice?: string
      fetcher?: typeof fetch
    } = {},
  ) {}

  private get baseUrl() {
    return (this.options.baseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '')
  }

  private get fetcher() {
    return this.options.fetcher ?? fetch
  }

  async transcribe(input: { audio: Blob; fileName: string; language: string | null }): Promise<TranscriptionResult> {
    const model = this.options.transcribeModel || DEFAULT_TRANSCRIBE_MODEL
    const body = new FormData()
    body.append('file', input.audio, input.fileName)
    body.append('model', model)
    body.append('response_format', 'json')
    if (input.language) body.append('language', input.language)

    let response: Response
    try {
      response = await this.fetcher(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      return { ok: false, error: 'OpenAI transcription request failed' }
    }

    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      return { ok: false, error: `OpenAI responded with ${response.status}`, status: response.status }
    }

    const text = getString(payload, 'text')
    if (text === null) {
      return { ok: false, error: 'OpenAI transcription did not include text' }
    }

    return { ok: true, text: text.trim(), model, usage: extractTranscriptionUsage(payload) }
  }

  async synthesize(input: { text: string; language: string | null }): Promise<SynthesisResult> {
    const model = this.options.ttsModel || DEFAULT_TTS_MODEL
    const voice = this.options.ttsVoice || DEFAULT_TTS_VOICE

    let response: Response
    try {
      response = await this.fetcher(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          voice,
          input: input.text,
          instructions: buildSpeechInstructions(input.language),
          response_format: 'mp3',
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      return { ok: false, error: 'OpenAI speech request failed' }
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      return { ok: false, error: `OpenAI responded with ${response.status}`, status: response.status }
    }

    const audio = await response.arrayBuffer()
    if (!audio.byteLength) {
      return { ok: false, error: 'OpenAI speech response was empty' }
    }

    return { ok: true, audio, contentType: 'audio/mpeg', model, voice }
  }
}

export function createSpeechProviderFromEnv(env: Record<string, string | undefined> = process.env): SpeechProvider | null {
  if (!isServerSpeechConfigured(env) || !env.OPENAI_API_KEY) return null

  return new OpenAISpeechProvider(env.OPENAI_API_KEY, {
    baseUrl: env.OPENAI_BASE_URL,
    transcribeModel: env.OPENAI_TRANSCRIBE_MODEL,
    ttsModel: env.OPENAI_TTS_MODEL,
    ttsVoice: env.OPENAI_TTS_VOICE,
  })
}

function extractTranscriptionUsage(payload: unknown): SpeechUsage {
  const usage = isRecord(payload) && isRecord(payload.usage) ? payload.usage : null
  return {
    inputTokens: usage ? getNumber(usage, 'input_tokens') : 0,
    outputTokens: usage ? getNumber(usage, 'output_tokens') : 0,
    audioSeconds: usage && typeof usage.seconds === 'number' ? usage.seconds : null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getString(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === 'string' ? value[key] as string : null
}

function getNumber(value: Record<string, unknown>, key: string) {
  const candidate = value[key]
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0
}
