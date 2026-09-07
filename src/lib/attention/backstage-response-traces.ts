import { z } from 'zod'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export const backstageResponseTraceChannels = ['web', 'email', 'whatsapp'] as const
export type BackstageResponseTraceChannel = (typeof backstageResponseTraceChannels)[number]

export type BackstageResponseTraceMetrics = {
  withSources: number
  withoutSources: number
  lowConfidence: number
  fallbacks: number
  responsePositive: number
  responseNegative: number
  sessionResolved: number
  sessionUnresolved: number
}

export type BackstageResponseTrace = {
  id: string
  channel: BackstageResponseTraceChannel
  conversationId: string
  conversationLabel: string | null
  content: string
  question: string | null
  createdAt: string
  status: string | null
  metadata: Json
  conversationMetadata: Json
}

export type BackstageResponseTracePage = {
  items: BackstageResponseTrace[]
  count: number
  channelCounts: Record<BackstageResponseTraceChannel, number>
  metrics: BackstageResponseTraceMetrics
}

const traceItemSchema = z.object({
  id: z.string(),
  channel: z.enum(backstageResponseTraceChannels),
  conversation_id: z.string(),
  conversation_label: z.string().nullable().optional(),
  content: z.string(),
  question: z.string().nullable().optional(),
  created_at: z.string(),
  status: z.string().nullable().optional(),
  metadata: z.unknown().optional(),
  conversation_metadata: z.unknown().optional(),
})

const responseSchema = z.object({
  items: z.array(traceItemSchema).default([]),
  count: z.number().default(0),
  channel_counts: z.object({
    web: z.number().default(0),
    email: z.number().default(0),
    whatsapp: z.number().default(0),
  }).default({ web: 0, email: 0, whatsapp: 0 }),
  metrics: z.object({
    with_sources: z.number().default(0),
    without_sources: z.number().default(0),
    low_confidence: z.number().default(0),
    fallbacks: z.number().default(0),
    response_positive: z.number().default(0),
    response_negative: z.number().default(0),
    session_resolved: z.number().default(0),
    session_unresolved: z.number().default(0),
  }).default({
    with_sources: 0,
    without_sources: 0,
    low_confidence: 0,
    fallbacks: 0,
    response_positive: 0,
    response_negative: 0,
    session_resolved: 0,
    session_unresolved: 0,
  }),
})

export async function getBackstageResponseTraces(
  admin: AdminClient,
  input: {
    tenantId: string
    channel: BackstageResponseTraceChannel | null
    limit: number
    offset: number
  },
): Promise<BackstageResponseTracePage> {
  const { data, error } = await admin.rpc('get_backstage_response_traces', {
    p_theatre_id: input.tenantId,
    p_channel: input.channel,
    p_limit: input.limit,
    p_offset: input.offset,
  })

  if (error) throw new Error(`No se pudo cargar la trazabilidad multicanal: ${error.message}`)
  return normalizeBackstageResponseTracePage(data)
}

export function normalizeBackstageResponseTracePage(value: unknown): BackstageResponseTracePage {
  const parsed = responseSchema.parse(value)

  return {
    items: parsed.items.map((item) => {
      const metadata = normalizeTraceMetadata(item.channel, item.metadata, item.question)
      return {
        id: item.id,
        channel: item.channel,
        conversationId: item.conversation_id,
        conversationLabel: item.conversation_label ?? null,
        content: item.content,
        question: item.question ?? null,
        createdAt: item.created_at,
        status: item.status ?? null,
        metadata: metadata as Json,
        conversationMetadata: toJsonRecord(item.conversation_metadata),
      }
    }),
    count: normalizeCount(parsed.count),
    channelCounts: {
      web: normalizeCount(parsed.channel_counts.web),
      email: normalizeCount(parsed.channel_counts.email),
      whatsapp: normalizeCount(parsed.channel_counts.whatsapp),
    },
    metrics: {
      withSources: normalizeCount(parsed.metrics.with_sources),
      withoutSources: normalizeCount(parsed.metrics.without_sources),
      lowConfidence: normalizeCount(parsed.metrics.low_confidence),
      fallbacks: normalizeCount(parsed.metrics.fallbacks),
      responsePositive: normalizeCount(parsed.metrics.response_positive),
      responseNegative: normalizeCount(parsed.metrics.response_negative),
      sessionResolved: normalizeCount(parsed.metrics.session_resolved),
      sessionUnresolved: normalizeCount(parsed.metrics.session_unresolved),
    },
  }
}

function normalizeTraceMetadata(
  channel: BackstageResponseTraceChannel,
  value: unknown,
  question: string | null | undefined,
) {
  const metadata = toRecord(value)
  const normalized = { ...metadata }

  if (question && typeof normalized.user_message !== 'string') normalized.user_message = question

  if (channel === 'email') {
    const agentTrace = toRecord(metadata.agent_trace)
    const drafter = toRecord(agentTrace.drafter)
    normalized.source = firstString(metadata.provider, drafter.provider, metadata.source) ?? 'unknown'
    normalized.requested_provider = firstString(metadata.requested_provider, drafter.requested_provider) ?? null
    normalized.model = firstString(metadata.model, drafter.model) ?? null
  }

  if (channel === 'whatsapp') {
    normalized.source = firstString(metadata.provider, metadata.source) ?? 'unknown'
    if (!Array.isArray(metadata.agent_sources) && Array.isArray(metadata.source_ids)) {
      normalized.agent_sources = metadata.source_ids
        .filter((sourceId): sourceId is string => typeof sourceId === 'string')
        .map((sourceId) => ({ id: sourceId, source_id: sourceId, source_type: null, score: null }))
    }
  }

  if (typeof normalized.retrieval_status !== 'string') {
    const knowledgeMatchCount = typeof metadata.knowledge_match_count === 'number'
      ? metadata.knowledge_match_count
      : null
    normalized.retrieval_status = hasRecordedSources(normalized) || (knowledgeMatchCount !== null && knowledgeMatchCount > 0)
      ? 'sources_used'
      : 'no_sources'
  }

  return normalized
}

function hasRecordedSources(metadata: Record<string, unknown>) {
  return (Array.isArray(metadata.agent_sources) && metadata.agent_sources.length > 0)
    || (Array.isArray(metadata.source_ids) && metadata.source_ids.length > 0)
}

function toJsonRecord(value: unknown): Json {
  return toRecord(value) as Json
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function normalizeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}
