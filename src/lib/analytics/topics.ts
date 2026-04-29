import type { createAdminClient } from '@/lib/supabase/admin'
import { getLatestUserMessage } from '@/lib/chat/service'

type AdminClient = ReturnType<typeof createAdminClient>

export type SaveTopicInput = {
  tenantId: string
  sessionId: string
  topic?: string
  userMessage?: string
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

export async function saveConversationTopic(admin: AdminClient, input: SaveTopicInput) {
  const userMessage = isExpressionLiteral(input.userMessage)
    ? await getLatestUserMessage(admin, input.tenantId, input.sessionId)
    : input.userMessage?.trim()
  const topic = normalizeTopic(input.topic, userMessage)

  const { error } = await admin
    .from('conversation_topics')
    .insert({
      theatre_id: input.tenantId,
      session_id: input.sessionId,
      topic,
      user_message: userMessage ?? '',
    })

  if (error) {
    return {
      ok: false as const,
      error: 'Failed to insert topic',
      details: error.message,
      code: error.code,
    }
  }

  return { ok: true as const }
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
