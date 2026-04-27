import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type TopicPayload = {
  session_id?: string
  topic?: string
  user_message?: string
}

const ALLOWED_TOPICS = new Set([
  'agenda',
  'precios',
  'horarios',
  'ubicacion',
  'visita',
  'entradas',
  'saludo',
  'otro',
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const payload = await request.json() as TopicPayload
  const topic = normalizeTopic(payload.topic)

  if (!payload.session_id || !topic) {
    return NextResponse.json({ error: 'Invalid topic payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('conversation_topics')
    .insert({
      theatre_id: tenantId,
      session_id: payload.session_id,
      topic,
      user_message: payload.user_message ?? '',
    })

  if (error) {
    return NextResponse.json({ error: 'Failed to insert topic' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function normalizeTopic(topic: string | undefined) {
  if (!topic) return null
  const normalized = topic.trim().toLowerCase()
  return ALLOWED_TOPICS.has(normalized) ? normalized : 'otro'
}
