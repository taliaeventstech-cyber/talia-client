import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

type SourceReference = {
  id: string | null
  sourceId: string | null
  sourceType: string | null
}

type KnowledgeSourceRow = {
  id: string
  name: string
  type: string
}

type KnowledgeItemRow = {
  id: string
  source_id: string | null
  question: string
}

export type ResponseSource = {
  label: string
  href: string
}

export type ResponseSourcesByMessageId = Map<string, {
  sources: ResponseSource[]
  additionalCount: number
}>

/**
 * Resolves the persisted grounding references into the names an operator knows
 * from Knowledge. The UI intentionally receives no scores, chunks, prompts or
 * other diagnostic metadata.
 */
export async function getResponseSourcesByMessageId(
  admin: AdminClient,
  input: {
    tenantId: string
    messages: Array<{ id: string; metadata: unknown }>
  },
): Promise<ResponseSourcesByMessageId> {
  const referencesByMessageId = new Map(
    input.messages.map((message) => [message.id, getResponseSourceReferences(message.metadata)]),
  )
  const references = [...referencesByMessageId.values()].flat()
  const itemIds = uniqueUuidIds(references.flatMap((reference) => [reference.id, reference.sourceId]))

  const itemsResult = itemIds.length
    ? await admin
      .from('knowledge_items')
      .select('id, source_id, question')
      .eq('theatre_id', input.tenantId)
      .in('id', itemIds)
    : { data: [] }
  const items = (itemsResult.data ?? []) as KnowledgeItemRow[]
  const sourceIds = uniqueUuidIds([
    ...references.map((reference) => reference.sourceId),
    ...items.map((item) => item.source_id),
  ])
  const sourcesResult = sourceIds.length
    ? await admin
      .from('knowledge_sources')
      .select('id, name, type')
      .eq('theatre_id', input.tenantId)
      .in('id', sourceIds)
    : { data: [] }

  return resolveResponseSourcesByMessageId(
    referencesByMessageId,
    items,
    (sourcesResult.data ?? []) as KnowledgeSourceRow[],
  )
}

export function getResponseSourceReferences(metadata: unknown): SourceReference[] {
  if (!isRecord(metadata)) return []

  const recordedSources = Array.isArray(metadata.agent_sources)
    ? metadata.agent_sources
      .map(toSourceReference)
      .filter((source): source is SourceReference => source !== null)
    : []
  if (recordedSources.length) return recordedSources

  const legacyReference = toSourceReference({
    id: metadata.knowledge_item_id,
    source_id: metadata.knowledge_source_id,
    source_type: metadata.knowledge_source_type,
  })
  return legacyReference ? [legacyReference] : []
}

export function resolveResponseSourcesByMessageId(
  referencesByMessageId: Map<string, SourceReference[]>,
  items: KnowledgeItemRow[],
  sources: KnowledgeSourceRow[],
): ResponseSourcesByMessageId {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const result: ResponseSourcesByMessageId = new Map()

  for (const [messageId, references] of referencesByMessageId) {
    const resolved = references.flatMap((reference) => {
      const directSource = reference.sourceId ? sourceById.get(reference.sourceId) : undefined
      if (directSource) return [toResponseSource(directSource)]

      const item = (reference.id ? itemById.get(reference.id) : undefined)
        ?? (reference.sourceId ? itemById.get(reference.sourceId) : undefined)
      if (!item) return []

      const itemSource = item.source_id ? sourceById.get(item.source_id) : undefined
      return [itemSource
        ? toResponseSource(itemSource)
        : {
            label: `FAQ: ${truncate(item.question, 96)}`,
            href: 'faqs',
          }]
    })
    const unique = resolved.filter((source, index, list) => list.findIndex((item) => item.label === source.label) === index)
    if (!unique.length) continue
    result.set(messageId, {
      sources: unique.slice(0, 3),
      additionalCount: Math.max(0, unique.length - 3),
    })
  }

  return result
}

function toSourceReference(value: unknown): SourceReference | null {
  if (!isRecord(value)) return null
  const id = getString(value.id)
  const sourceId = getString(value.source_id)
  const sourceType = getString(value.source_type)
  return id || sourceId || sourceType ? { id, sourceId, sourceType } : null
}

function toResponseSource(source: KnowledgeSourceRow): ResponseSource {
  return {
    label: truncate(source.name, 120),
    href: getKnowledgeTab(source.type),
  }
}

function getKnowledgeTab(sourceType: string) {
  if (sourceType === 'pdf') return 'files'
  if (sourceType === 'manual') return 'faqs'
  return 'installed'
}

function uniqueUuidIds(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => value !== null && isUuid(value)))]
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function truncate(value: string, length: number) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
