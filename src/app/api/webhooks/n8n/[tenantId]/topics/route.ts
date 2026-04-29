import { createAdminClient } from '@/lib/supabase/admin'
import { saveConversationTopic } from '@/lib/analytics/topics'
import { NextRequest, NextResponse } from 'next/server'

type TopicPayload = {
  session_id?: string
  topic?: string
  user_message?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const payload = await request.json() as TopicPayload

  if (!payload.session_id) {
    return NextResponse.json({ error: 'Invalid topic payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const saved = await saveConversationTopic(supabase, {
    tenantId,
    sessionId: payload.session_id,
    topic: payload.topic,
    userMessage: payload.user_message,
  })

  if (!saved.ok) {
    return NextResponse.json(saved, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
