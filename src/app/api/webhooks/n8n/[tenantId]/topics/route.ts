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

  if (!payload.session_id) {
    return NextResponse.json({ error: 'Invalid topic payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const userMessage = isExpressionLiteral(payload.user_message)
    ? await getLatestUserMessage(supabase, tenantId, payload.session_id)
    : payload.user_message?.trim()
  const topic = normalizeTopic(payload.topic, userMessage)

  const { error } = await supabase
    .from('conversation_topics')
    .insert({
      theatre_id: tenantId,
      session_id: payload.session_id,
      topic,
      user_message: userMessage ?? '',
    })

  if (error) {
    console.error('Failed to insert conversation topic', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })

    return NextResponse.json({
      error: 'Failed to insert topic',
      details: error.message,
      code: error.code,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function normalizeTopic(topic: string | undefined, userMessage: string | undefined) {
  if (topic && !isExpressionLiteral(topic)) {
    const normalized = topic.trim().toLowerCase()
    if (ALLOWED_TOPICS.has(normalized)) return normalized
  }

  return inferTopic(userMessage)
}

function isExpressionLiteral(value: string | undefined) {
  if (!value) return false
  return value.trim().startsWith('={{')
}

async function getLatestUserMessage(
  supabase: ReturnType<typeof createAdminClient>,
  theatreId: string,
  sessionId: string
) {
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('theatre_id', theatreId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!conversation) return undefined

  const { data: message } = await supabase
    .from('messages')
    .select('content')
    .eq('theatre_id', theatreId)
    .eq('conversation_id', conversation.id)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return message?.content
}

function inferTopic(message: string | undefined) {
  if (!message) return 'otro'
  const normalized = normalizeText(message)

  if (matches(normalized, ['hola', 'buenas', 'bon dia', 'hello', 'hi'])) return 'saludo'
  if (matches(normalized, ['agenda', 'programacion', 'programacio', 'exposicion', 'exposicio', 'pompeia', 'evento', 'events'])) return 'agenda'
  if (matches(normalized, ['precio', 'preu', 'preus', 'tarifa', 'cuesta', 'cost', 'price', 'prices'])) return 'precios'
  if (matches(normalized, ['horario', 'horaris', 'hora', 'abierto', 'obert', 'open', 'opening'])) return 'horarios'
  if (matches(normalized, ['donde', 'on es', 'ubicacion', 'ubicacio', 'direccion', 'adreca', 'llegar', 'arribar', 'metro', 'location'])) return 'ubicacion'
  if (matches(normalized, ['visita', 'duracion', 'durada', 'vr', 'acceso', 'accesible', 'wheelchair'])) return 'visita'
  if (matches(normalized, ['entrada', 'entradas', 'ticket', 'tickets', 'comprar', 'reserva', 'booking'])) return 'entradas'

  return 'otro'
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function matches(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword))
}
