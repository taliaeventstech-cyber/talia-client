import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyHmacSignature } from '@/lib/n8n/client'

type IncomingMessage = {
  role: 'user' | 'assistant'
  content: string
}

type WebhookPayload = {
  session_id: string
  messages: IncomingMessage[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const rawBody = await request.text()
  const signature = request.headers.get('x-n8n-signature') ?? ''

  const supabase = createAdminClient()

  const { data: theatre, error: theatreError } = await supabase
    .from('theatres')
    .select('n8n_hmac_secret')
    .eq('id', tenantId)
    .single()

  if (theatreError || !theatre) {
    return NextResponse.json({ error: 'Theatre not found' }, { status: 404 })
  }

  if (theatre.n8n_hmac_secret && !verifyHmacSignature(rawBody, signature, theatre.n8n_hmac_secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as WebhookPayload

  // Crear conversación si no existe — si ya existe, no tocar nada (el trigger gestiona message_count)
  const { data: upserted, error: upsertError } = await supabase
    .from('conversations')
    .upsert(
      { theatre_id: tenantId, session_id: payload.session_id },
      { onConflict: 'session_id' }
    )
    .select('id')
    .single()

  if (upsertError || !upserted) {
    return NextResponse.json({ error: 'Failed to upsert conversation' }, { status: 500 })
  }

  // Insertar solo los mensajes nuevos — el trigger incrementa message_count automáticamente
  const messages = payload.messages.map((msg) => ({
    conversation_id: upserted.id,
    theatre_id: tenantId,
    role: msg.role,
    content: msg.content,
  }))

  const { error: msgError } = await supabase.from('messages').insert(messages)

  if (msgError) {
    return NextResponse.json({ error: 'Failed to insert messages' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conversation_id: upserted.id })
}
