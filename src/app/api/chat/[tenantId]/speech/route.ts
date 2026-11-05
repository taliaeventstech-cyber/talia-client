import { corsHeaders, corsJson, corsNoContent } from '@/lib/http/cors'
import { speechSynthesisRequestSchema } from '@/lib/widget/speech'
import { guardVoiceRequest, normalizeVoicePageUrl, recordVoiceUsage } from '@/lib/widget/voice-request-guard'

/** Web Agent voice mode: reply text → spoken audio (talia-ai text-to-speech). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return corsJson({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = speechSynthesisRequestSchema.safeParse(body)
  if (!parsed.success) {
    return corsJson(
      { error: parsed.error.issues[0]?.message ?? 'Invalid speech request' },
      { status: 400 },
    )
  }

  const input = parsed.data
  const guard = await guardVoiceRequest(request, {
    tenantId,
    pageUrl: normalizeVoicePageUrl(input.page_url),
    kind: 'speech',
  })
  if (!guard.ok) return guard.response

  const result = await guard.provider.synthesize({
    tenantId,
    sessionId: input.session_id,
    text: input.text,
    language: input.language ?? null,
    pace: input.pace,
  })

  if (!result.ok) {
    console.warn('[voice] speech synthesis failed', { tenantId, error: result.error })
    return corsJson({ error: 'speech_failed' }, { status: 502 })
  }

  await recordVoiceUsage(guard.admin, {
    tenantId,
    sessionId: input.session_id,
    components: result.usageComponents,
    metadata: {
      characters: input.text.length,
      voice: result.voice,
      pace: input.pace,
      language: input.language ?? null,
      audio_bytes: result.audio.byteLength,
    },
  })

  return new Response(result.audio, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': result.contentType,
      'Cache-Control': 'no-store',
    },
  })
}

export function OPTIONS() {
  return corsNoContent()
}
