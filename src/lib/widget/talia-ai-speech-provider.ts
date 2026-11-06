import { z } from 'zod'
import type { ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import type { AgentVoice } from './agent-voices'
import { isServerSpeechConfigured } from './speech'

// talia-ai retries OpenAI audio calls internally (30 s attempts + backoff).
const TRANSCRIBE_TIMEOUT_MS = 45_000
const SPEECH_TIMEOUT_MS = 45_000

const usageComponentSchema = z.object({
  component: z.enum(['speech_to_text', 'text_to_speech']),
  provider: z.string().min(1),
  model: z.string().min(1),
  request_count: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  cached_input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
})

const transcribeResponseSchema = z.object({
  ok: z.literal(true),
  text: z.string(),
  usage_components: z.array(usageComponentSchema),
})

const speechResponseSchema = z.object({
  ok: z.literal(true),
  audio_base64: z.string().min(1),
  content_type: z.literal('audio/mpeg'),
  usage_components: z.array(usageComponentSchema),
  metadata: z.object({ voice: z.string() }).passthrough(),
})

export type SpeechUsageComponent = ChatAiUsageComponent & { component: 'speech_to_text' | 'text_to_speech' }

export type TranscriptionResult =
  | { ok: true; text: string; usageComponents: SpeechUsageComponent[] }
  | { ok: false; error: string; status?: number }

export type SynthesisResult =
  | { ok: true; audio: Uint8Array<ArrayBuffer>; contentType: 'audio/mpeg'; voice: string; usageComponents: SpeechUsageComponent[] }
  | { ok: false; error: string; status?: number }

export interface SpeechProvider {
  transcribe(input: {
    tenantId: string
    sessionId: string
    audio: Blob
    mimeType: string
    language: string | null
  }): Promise<TranscriptionResult>
  synthesize(input: {
    tenantId: string
    sessionId: string
    text: string
    language: string | null
    pace: 'normal' | 'slow'
    voice?: AgentVoice
  }): Promise<SynthesisResult>
}

/**
 * Server-to-server client for talia-ai's `/v1/voice/*` endpoints. The browser
 * never talks to talia-ai or OpenAI; it only reaches the guarded Next routes.
 */
export class TaliaAiSpeechProvider implements SpeechProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async transcribe(input: Parameters<SpeechProvider['transcribe']>[0]): Promise<TranscriptionResult> {
    const audioBase64 = Buffer.from(await input.audio.arrayBuffer()).toString('base64')
    const result = await this.post('/v1/voice/transcribe', {
      tenant_id: input.tenantId,
      session_id: input.sessionId,
      audio_base64: audioBase64,
      mime_type: input.mimeType,
      ...(input.language ? { language: input.language } : {}),
    }, TRANSCRIBE_TIMEOUT_MS)
    if (!result.ok) return result

    const parsed = transcribeResponseSchema.safeParse(result.body)
    if (!parsed.success) return { ok: false, error: 'talia-ai returned an invalid transcription' }

    return { ok: true, text: parsed.data.text.trim(), usageComponents: parsed.data.usage_components }
  }

  async synthesize(input: Parameters<SpeechProvider['synthesize']>[0]): Promise<SynthesisResult> {
    const result = await this.post('/v1/voice/speech', {
      tenant_id: input.tenantId,
      session_id: input.sessionId,
      text: input.text,
      pace: input.pace,
      ...(input.language ? { language: input.language } : {}),
      ...(input.voice ? { voice: input.voice } : {}),
    }, SPEECH_TIMEOUT_MS)
    if (!result.ok) return result

    const parsed = speechResponseSchema.safeParse(result.body)
    if (!parsed.success) return { ok: false, error: 'talia-ai returned invalid speech audio' }

    const audio = new Uint8Array(Buffer.from(parsed.data.audio_base64, 'base64'))
    if (!audio.byteLength) return { ok: false, error: 'talia-ai returned empty speech audio' }

    return {
      ok: true,
      audio,
      contentType: parsed.data.content_type,
      voice: parsed.data.metadata.voice,
      usageComponents: parsed.data.usage_components,
    }
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<{ ok: true; body: unknown } | { ok: false; error: string; status?: number }> {
    let response: Response
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      return { ok: false, error: 'talia-ai voice request failed' }
    }

    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      // talia-ai errors carry a code and a short, content-free reason (e.g.
      // "OpenAI responded with 404"); keep them so operators can diagnose.
      const errorBody = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
      const code = typeof errorBody.error === 'string' ? errorBody.error.slice(0, 64) : null
      const details = typeof errorBody.details === 'string' ? errorBody.details.slice(0, 200) : null
      const reason = [code, details].filter(Boolean).join(': ')
      return {
        ok: false,
        error: `talia-ai responded with ${response.status}${reason ? ` (${reason})` : ''}`,
        status: response.status,
      }
    }
    return { ok: true, body: payload }
  }
}

export function createSpeechProviderFromEnv(env: Record<string, string | undefined> = process.env): SpeechProvider | null {
  if (!isServerSpeechConfigured(env)) return null
  const baseUrl = env.TALIA_AI_BASE_URL?.replace(/\/+$/, '')
  const apiKey = env.TALIA_AI_INTERNAL_API_KEY
  if (!baseUrl || !apiKey) return null
  return new TaliaAiSpeechProvider(baseUrl, apiKey)
}
