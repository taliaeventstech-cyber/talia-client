import { createAdminClient } from '@/lib/supabase/admin'
import { classifyConversationTopic, saveConversationTopic } from '@/lib/analytics/topics'
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
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }

  const signature = request.headers.get('elevenlabs-signature')
  if (!signature) return false

  // ElevenLabs sends: t=<timestamp>,v0=<hmac>
  const parts = Object.fromEntries(signature.split(',').map((part) => {
    const [key, ...value] = part.trim().split('=')
    return [key, value.join('=')]
  }))
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

  return timingSafeEqualHex(expectedHmac, receivedHmac)
}

function timingSafeEqualHex(expected: string, received: string) {
  if (!/^[a-f0-9]+$/i.test(received) || expected.length !== received.length) return false

  const expectedBytes = hexToBytes(expected)
  const receivedBytes = hexToBytes(received)
  if (expectedBytes.length !== receivedBytes.length) return false

  let diff = 0
  for (let i = 0; i < expectedBytes.length; i += 1) {
    diff |= expectedBytes[i] ^ receivedBytes[i]
  }
  return diff === 0
}

function hexToBytes(value: string) {
  const bytes = new Uint8Array(value.length / 2)
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = Number.parseInt(value.slice(i, i + 2), 16)
  }
  return bytes
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
  const summary = data.analysis?.transcript_summary ?? null
  const lastUserMessage = transcript ? [...transcript].reverse().find((m) => m.role === 'user')?.content : undefined
  const topic = classifyConversationTopic(summary ?? undefined, lastUserMessage)

  const { error: insertError } = await admin.from('voice_conversations').upsert({
    theatre_id: theatreId,
    call_sid: data.conversation_id,
    status: data.status ?? null,
    from_number: fromNumber,
    duration_sec: durationSec ? Math.round(durationSec) : null,
    turns,
    transcript,
    summary,
    topic,
  }, { onConflict: 'call_sid' })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Save topic to shared analytics (shows up in Data → Temas e intención under "Voz")
  if (lastUserMessage) {
    await admin
      .from('conversation_topics')
      .delete()
      .eq('theatre_id', theatreId)
      .eq('session_id', data.conversation_id)
      .eq('channel', 'voice')

    await saveConversationTopic(admin, {
      tenantId: theatreId,
      sessionId: data.conversation_id,
      topic,
      userMessage: lastUserMessage,
      channel: 'voice',
    })
  }

  return NextResponse.json({ ok: true })
}
