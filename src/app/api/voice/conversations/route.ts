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

async function verifyElevenLabsSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
  if (!secret) return true // no secret configured → skip verification

  const signature = request.headers.get('elevenlabs-signature')
  if (!signature) return false

  // ElevenLabs sends: t=<timestamp>,v0=<hmac>
  const parts = Object.fromEntries(signature.split(',').map((p) => p.split('=')))
  const timestamp = parts['t']
  const receivedHmac = parts['v0']
  if (!timestamp || !receivedHmac) return false

  // Reject if timestamp is older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  const expectedHmac = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')

  return expectedHmac === receivedHmac
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const isValid = await verifyElevenLabsSignature(request, rawBody)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
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
