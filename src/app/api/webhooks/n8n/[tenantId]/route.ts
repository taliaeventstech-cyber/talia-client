import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyHmacSignature } from '@/lib/n8n/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const rawBody = await request.text()
  const signature = request.headers.get('x-n8n-signature') ?? ''

  const supabase = createAdminClient()

  // Obtener el secreto HMAC del teatro
  const { data: theatre, error } = await supabase
    .from('theatres')
    .select('n8n_hmac_secret')
    .eq('id', tenantId)
    .single()

  if (error || !theatre) {
    return NextResponse.json({ error: 'Theatre not found' }, { status: 404 })
  }

  if (theatre.n8n_hmac_secret && !verifyHmacSignature(rawBody, signature, theatre.n8n_hmac_secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as {
    session_id: string
    messages: Array<{ role: 'user' | 'assistant'; content: string; created_at?: string }>
  }

  // Crear o recuperar la conversación
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .upsert({
      theatre_id: tenantId,
      session_id: payload.session_id,
      message_count: payload.messages.length,
    }, { onConflict: 'session_id' })
    .select('id')
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Failed to upsert conversation' }, { status: 500 })
  }

  // Insertar mensajes
  const messages = payload.messages.map((msg) => ({
    conversation_id: conversation.id,
    theatre_id: tenantId,
    role: msg.role,
    content: msg.content,
    created_at: msg.created_at,
  }))

  const { error: msgError } = await supabase.from('messages').insert(messages)

  if (msgError) {
    return NextResponse.json({ error: 'Failed to insert messages' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
