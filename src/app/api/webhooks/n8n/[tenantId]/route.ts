import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyHmacSignature } from '@/lib/n8n/client'
import { saveConversation, type IncomingChatMessage } from '@/lib/chat/service'
import { getTenantWebhookSecret } from '@/lib/tenants/service'
import type { Json } from '@/types/database.types'

type WebhookPayload = {
  session_id: string
  messages: IncomingChatMessage[]
  metadata?: Json
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const rawBody = await request.text()
  const signature = request.headers.get('x-n8n-signature') ?? ''

  const supabase = createAdminClient()

  const webhookSecret = await getTenantWebhookSecret(supabase, tenantId)
  if (!webhookSecret.ok) {
    return NextResponse.json({ error: 'Theatre not found' }, { status: 404 })
  }

  if (webhookSecret.secret && !verifyHmacSignature(rawBody, signature, webhookSecret.secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as WebhookPayload
  const saved = await saveConversation(supabase, {
    tenantId,
    sessionId: payload.session_id,
    messages: payload.messages,
    metadata: payload.metadata,
  })

  if (!saved.ok) {
    return NextResponse.json({ error: saved.error, details: saved.details }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conversation_id: saved.conversationId })
}
