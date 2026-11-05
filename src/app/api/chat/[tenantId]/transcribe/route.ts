import { corsJson, corsNoContent } from '@/lib/http/cors'
import { MAX_SPEECH_AUDIO_BYTES, parseTranscriptionForm } from '@/lib/widget/speech'
import { guardVoiceRequest, normalizeVoicePageUrl, recordVoiceUsage, voiceProviderFailure } from '@/lib/widget/voice-request-guard'

// Multipart overhead on top of the audio itself.
const MAX_REQUEST_BYTES = MAX_SPEECH_AUDIO_BYTES + 64_000

/** Web Agent voice mode: visitor audio → text (talia-ai speech-to-text). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_REQUEST_BYTES) {
    return corsJson({ error: 'audio is too large' }, { status: 413 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return corsJson({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const parsed = parseTranscriptionForm(form)
  if (!parsed.ok) {
    return corsJson({ error: parsed.error }, { status: parsed.status })
  }

  const input = parsed.value
  const guard = await guardVoiceRequest(request, {
    tenantId,
    pageUrl: normalizeVoicePageUrl(input.pageUrl),
    kind: 'transcribe',
  })
  if (!guard.ok) return guard.response

  const result = await guard.provider.transcribe({
    tenantId,
    sessionId: input.sessionId,
    audio: input.audio,
    mimeType: input.mimeType,
    language: input.language,
  })

  if (!result.ok) {
    console.warn('[voice] transcription failed', { tenantId, error: result.error })
    return voiceProviderFailure(result.status, 'transcription_failed')
  }

  await recordVoiceUsage(guard.admin, {
    tenantId,
    sessionId: input.sessionId,
    components: result.usageComponents,
    metadata: {
      audio_bytes: input.audio.size,
      language_hint: input.language,
      empty_transcript: !result.text,
    },
  })

  return corsJson({ text: result.text })
}

export function OPTIONS() {
  return corsNoContent()
}
