import type { createAdminClient } from '@/lib/supabase/admin'
import { getLatestUserMessage } from '@/lib/chat/service'
import type { AttentionChannel } from '@/lib/attention/channel-agent'

type AdminClient = ReturnType<typeof createAdminClient>

export type Channel = AttentionChannel

export type SaveTopicInput = {
  tenantId: string
  sessionId: string
  messageId?: string
  topic?: string
  intent?: ChatAnalyticsIntent
  confidence?: number
  taxonomyVersion?: string
  classificationSource?: ChatAnalyticsSource
  userMessage?: string
  channel?: Channel
}

const ALLOWED_TOPICS = new Set<ChatAnalyticsTopic>([
  'agenda',
  'precios',
  'horarios',
  'ubicacion',
  'visita',
  'entradas',
  'accesibilidad',
  'otro',
])

const ALLOWED_INTENTS = new Set<ChatAnalyticsIntent>([
  'information',
  'planning',
  'transaction',
  'navigation',
  'support',
  'greeting',
  'other',
])

const ALLOWED_SOURCES = new Set<ChatAnalyticsSource>(['answer_agent', 'runtime'])

export type ChatAnalyticsTopic =
  | 'agenda'
  | 'precios'
  | 'horarios'
  | 'ubicacion'
  | 'visita'
  | 'entradas'
  | 'accesibilidad'
  | 'otro'

export type ChatAnalyticsIntent =
  | 'information'
  | 'planning'
  | 'transaction'
  | 'navigation'
  | 'support'
  | 'greeting'
  | 'other'

export type ChatAnalyticsSource = 'answer_agent' | 'runtime'

export type ChatAnalytics = {
  topic: ChatAnalyticsTopic
  intent: ChatAnalyticsIntent
  confidence: number
  taxonomyVersion: string
  source: ChatAnalyticsSource
}

export async function saveConversationTopic(admin: AdminClient, input: SaveTopicInput) {
  const userMessage = isExpressionLiteral(input.userMessage)
    ? await getLatestUserMessage(admin, input.tenantId, input.sessionId)
    : input.userMessage?.trim()
  const topic = classifyConversationTopic(input.topic, userMessage)

  const record = {
    theatre_id: input.tenantId,
    session_id: input.sessionId,
    message_id: input.messageId ?? null,
    topic,
    intent: input.intent ?? null,
    confidence: normalizeConfidence(input.confidence),
    taxonomy_version: input.taxonomyVersion ?? null,
    classification_source: input.classificationSource ?? null,
    user_message: userMessage ?? '',
    channel: input.channel ?? 'web',
  }
  const query = input.messageId
    ? admin.from('conversation_topics').upsert(record, { onConflict: 'message_id' })
    : admin.from('conversation_topics').insert(record)
  const { error } = await query

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

export function classifyConversationTopic(topic: string | undefined, userMessage: string | undefined): ChatAnalyticsTopic {
  if (topic && !isExpressionLiteral(topic)) {
    const normalized = normalizeText(topic).trim()
    if (normalized === 'saludo') {
      return inferTopic(userMessage)
    }
    if (ALLOWED_TOPICS.has(normalized as ChatAnalyticsTopic) && normalized !== 'otro') {
      return normalized as ChatAnalyticsTopic
    }
  }

  return inferTopic(userMessage)
}

export function parseChatAnalytics(value: unknown): ChatAnalytics | null {
  if (!isRecord(value)) return null

  const topic = value.topic
  const intent = value.intent
  const confidence = value.confidence
  const taxonomyVersion = value.taxonomy_version
  const source = value.source

  if (
    typeof topic !== 'string'
    || !ALLOWED_TOPICS.has(topic as ChatAnalyticsTopic)
    || typeof intent !== 'string'
    || !ALLOWED_INTENTS.has(intent as ChatAnalyticsIntent)
    || typeof confidence !== 'number'
    || !Number.isFinite(confidence)
    || confidence < 0
    || confidence > 1
    || typeof taxonomyVersion !== 'string'
    || !taxonomyVersion.trim()
    || typeof source !== 'string'
    || !ALLOWED_SOURCES.has(source as ChatAnalyticsSource)
  ) return null

  return {
    topic: topic as ChatAnalyticsTopic,
    intent: intent as ChatAnalyticsIntent,
    confidence,
    taxonomyVersion: taxonomyVersion.trim(),
    source: source as ChatAnalyticsSource,
  }
}

export function getFallbackChatAnalytics(message: string): ChatAnalytics {
  const topic = classifyConversationTopic(undefined, message) as ChatAnalyticsTopic
  const normalized = normalizeText(message)
  let intent: ChatAnalyticsIntent = 'other'

  if (matches(normalized, ['queja', 'reclamacion', 'devolucion', 'problema', 'refund', 'complaint', 'contactar', 'contact'])) {
    intent = 'support'
  } else if (matches(normalized, ['comprar', 'reserva', 'reservar', 'booking', 'book', 'purchase'])) {
    intent = 'transaction'
  } else if (topic === 'ubicacion') {
    intent = 'navigation'
  } else if (topic === 'agenda' || topic === 'horarios' || topic === 'visita' || topic === 'accesibilidad') {
    intent = 'planning'
  } else if (topic !== 'otro') {
    intent = 'information'
  }

  return {
    topic,
    intent,
    confidence: topic === 'otro' ? 0.35 : 0.65,
    taxonomyVersion: 'chat-v1',
    source: 'runtime',
  }
}

function isExpressionLiteral(value: string | undefined) {
  if (!value) return false
  return value.trim().startsWith('={{')
}

function inferTopic(message: string | undefined) {
  if (!message) return 'otro'
  const normalized = normalizeText(message)

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

function normalizeConfidence(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(1, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
