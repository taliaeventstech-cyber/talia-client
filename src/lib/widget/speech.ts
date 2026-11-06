import { z } from 'zod'

// Web Agent voice mode (server side). The widget records the visitor; these
// guarded public routes forward audio/text to talia-ai, which calls OpenAI.
// Limits are deliberately tight: these are public, unauthenticated endpoints
// that spend money per call.

/** ~30 s of compressed speech in any browser codec fits comfortably. */
export const MAX_SPEECH_AUDIO_BYTES = 2_000_000
/** Long replies are split by the widget into chunks of at most this size. */
export const MAX_SPEECH_TEXT_CHARACTERS = 1_200

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a',
])

// Aliases normalized to the MIME types talia-ai's /v1/voice/transcribe accepts.
const CANONICAL_AUDIO_TYPES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/x-m4a': 'audio/m4a',
}

const AUDIO_FILE_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/aac': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
}

const sessionIdSchema = z.string().trim().min(1).max(128)

export const speechSynthesisRequestSchema = z.object({
  session_id: sessionIdSchema,
  text: z.string().trim().min(1).max(MAX_SPEECH_TEXT_CHARACTERS),
  language: z.string().trim().max(35).optional(),
  page_url: z.string().trim().max(2048).optional(),
  // "Slower" voice command.
  pace: z.enum(['normal', 'slow']).default('normal'),
})

export type SpeechSynthesisRequest = z.infer<typeof speechSynthesisRequestSchema>

export type TranscriptionRequest = {
  sessionId: string
  audio: Blob
  mimeType: string
  fileName: string
  language: string | null
  pageUrl: string | undefined
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string }

/** Strips codec parameters (`audio/webm;codecs=opus` → `audio/webm`). */
export function normalizeAudioMimeType(value: string | null | undefined) {
  return String(value ?? '').split(';')[0].trim().toLowerCase()
}

export function isAllowedAudioMimeType(value: string | null | undefined) {
  return ALLOWED_AUDIO_TYPES.has(normalizeAudioMimeType(value))
}

/**
 * Reduces a BCP 47 tag to the ISO-639-1 code OpenAI's transcription endpoint
 * accepts as a hint. Returns null when the value is not usable, which lets the
 * model auto-detect the visitor's language.
 */
export function getTranscriptionLanguageHint(value: string | null | undefined) {
  const base = String(value ?? '').trim().toLowerCase().split(/[-_]/)[0]
  return /^[a-z]{2}$/.test(base) ? base : null
}

export function parseTranscriptionForm(form: FormData): ParseResult<TranscriptionRequest> {
  const audio = form.get('audio')
  if (!(audio instanceof Blob)) {
    return { ok: false, status: 400, error: 'audio is required' }
  }

  if (audio.size === 0) {
    return { ok: false, status: 400, error: 'audio is empty' }
  }

  if (audio.size > MAX_SPEECH_AUDIO_BYTES) {
    return { ok: false, status: 413, error: 'audio is too large' }
  }

  const rawMimeType = normalizeAudioMimeType(audio.type)
  if (!isAllowedAudioMimeType(rawMimeType)) {
    return { ok: false, status: 415, error: 'unsupported audio type' }
  }
  const mimeType = CANONICAL_AUDIO_TYPES[rawMimeType] ?? rawMimeType

  const sessionId = sessionIdSchema.safeParse(form.get('session_id'))
  if (!sessionId.success) {
    return { ok: false, status: 400, error: 'session_id is required' }
  }

  const pageUrl = form.get('page_url')
  const language = form.get('language')

  return {
    ok: true,
    value: {
      sessionId: sessionId.data,
      audio,
      mimeType,
      fileName: `speech.${AUDIO_FILE_EXTENSIONS[mimeType] ?? 'webm'}`,
      language: getTranscriptionLanguageHint(typeof language === 'string' ? language : null),
      pageUrl: typeof pageUrl === 'string' && pageUrl.length <= 2048 ? pageUrl : undefined,
    },
  }
}

/**
 * Whether TALIA voice (talia-ai → OpenAI) is available; otherwise the widget
 * uses the browser's own speech engine. `WIDGET_SERVER_VOICE_ENABLED=false`
 * is the kill switch.
 */
export function isServerSpeechConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.TALIA_AI_BASE_URL && env.TALIA_AI_INTERNAL_API_KEY)
    && env.WIDGET_SERVER_VOICE_ENABLED !== 'false'
}

export function getPublicVoiceConfig(env: Record<string, string | undefined> = process.env) {
  return { provider: isServerSpeechConfigured(env) ? 'talia' as const : 'browser' as const }
}
