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
  'accesibilidad',
  'saludo',
  'otro',
])

export async function saveConversationTopic(admin: AdminClient, input: SaveTopicInput) {
  const userMessage = isExpressionLiteral(input.userMessage)
    ? await getLatestUserMessage(admin, input.tenantId, input.sessionId)
    : input.userMessage?.trim()
  const topic = classifyConversationTopic(input.topic, userMessage)

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

export function classifyConversationTopic(topic: string | undefined, userMessage: string | undefined) {
  if (topic && !isExpressionLiteral(topic)) {
    const normalized = normalizeText(topic).trim()
    if (ALLOWED_TOPICS.has(normalized) && normalized !== 'otro') return normalized
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

  if (matches(normalized, ['hola', 'buenas', 'bon dia', 'bona tarda', 'bona nit', 'hello'])) return 'saludo'
  if (matches(normalized, ['accessible', 'accessibilitat', 'accesibilidad', 'accesible', 'adaptado', 'adaptada', 'cadira de rodes', 'silla de ruedas', 'movilidad reducida', 'wheelchair'])) return 'accesibilidad'
  if (matches(normalized, ['entrada', 'entradas', 'entrades', 'ticket', 'tickets', 'comprar', 'compra', 'reserva', 'reservar', 'booking'])) return 'entradas'
  if (matches(normalized, ['precio', 'precios', 'preu', 'preus', 'tarifa', 'tarifas', 'descuento', 'descuentos', 'descompte', 'descomptes', 'cuesta', 'cost', 'price', 'prices'])) return 'precios'
  if (matches(normalized, ['horario', 'horarios', 'horari', 'horaris', 'hora', 'abierto', 'obert', 'oberta', 'open', 'opening', 'taquilla'])) return 'horarios'
  if (matches(normalized, ['donde', 'on es', 'ubicacion', 'ubicacio', 'direccion', 'adreca', 'llegar', 'arribar', 'metro', 'bus', 'parking', 'aparcamiento', 'location', 'mapa'])) return 'ubicacion'
  if (matches(normalized, ['agenda', 'programacion', 'programacio', 'cartelera', 'espectaculo', 'espectaculos', 'espectacle', 'espectacles', 'obra', 'obres', 'exposicion', 'exposicio', 'evento', 'events'])) return 'agenda'
  if (matches(normalized, ['visita', 'visitar', 'duracion', 'durada', 'vr', 'recorrido', 'experiencia'])) return 'visita'

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
