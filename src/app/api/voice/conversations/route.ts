import { createAdminClient } from '@/lib/supabase/admin'
import { saveConversationTopic } from '@/lib/analytics/topics'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ElevenLabs post-call webhook payload
const elevenLabsSchema = z.object({
  type: z.literal('post_call_transcription'),
  data: z.object({
    agent_id: z.string(),
    conversation_id: z.string(),
    status: z.string().optional(),
    transcript: z.array(z.object({
      role: z.enum(['agent', 'user']),
      message: z.string(),
      time_in_call_secs: z.number().optional(),
    })).optional(),
    metadata: z.object({
      call_duration_secs: z.number().optional(),
      phone_call: z.object({
        caller_id: z.string().optional(),
        agent_number: z.string().optional(),
      }).optional(),
    }).optional(),
    analysis: z.object({
      transcript_summary: z.string().optional(),
    }).optional(),
  }),
})

export async function POST(request: NextRequest) {
  const internalKey = process.env.INTERNAL_API_KEY
  const providedKey = request.headers.get('x-talia-internal-key')
  // ElevenLabs signs with its own secret; for now we accept any request that
  // either matches the internal key or comes without one (ElevenLabs path).
  // TODO: verify ElevenLabs webhook signature header when secret is configured.
  if (internalKey && providedKey && providedKey !== internalKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = elevenLabsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  }

  const { data } = parsed.data
  const admin = createAdminClient()

  // Resolve theatre from ElevenLabs agent ID
  const { data: theatre, error: theatreError } = await admin
    .from('theatres')
    .select('id')
    .eq('elevenlabs_agent_id', data.agent_id)
    .eq('voice_enabled', true)
    .single()

  if (theatreError || !theatre) {
    return NextResponse.json({ error: 'No active voice agent for this agent_id' }, { status: 404 })
  }

  const theatreId = theatre.id

  // Map ElevenLabs transcript format to our storage format
  const transcript = data.transcript?.map((t) => ({
    role: t.role === 'agent' ? 'assistant' : 'user',
    content: t.message,
  })) ?? null

  const fromNumber = data.metadata?.phone_call?.caller_id ?? null
  const durationSec = data.metadata?.call_duration_secs ?? null
  const turns = transcript ? Math.floor(transcript.length / 2) : null

  const { error: insertError } = await admin.from('voice_conversations').insert({
    theatre_id: theatreId,
    call_sid: data.conversation_id,
    from_number: fromNumber,
    duration_sec: durationSec ? Math.round(durationSec) : null,
    turns,
    transcript,
    topic: data.analysis?.transcript_summary ?? null,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Save topic to shared analytics (shows up in Data → Temas e intención under "Voz")
  if (transcript?.length) {
    const lastUserMessage = [...transcript].reverse().find((m) => m.role === 'user')?.content
    await saveConversationTopic(admin, {
      tenantId: theatreId,
      sessionId: data.conversation_id,
      topic: data.analysis?.transcript_summary,
      userMessage: lastUserMessage,
      channel: 'voice',
    })
  }

  return NextResponse.json({ ok: true })
}
