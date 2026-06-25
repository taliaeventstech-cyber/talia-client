import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type KnowledgeItem = {
  id: string
  source_id: string | null
  question: string
  answer: string
  category: string | null
  language: string
  priority: number
  metadata: Record<string, unknown> | null
}

export type KnowledgeMatch = KnowledgeItem & {
  score: number
}

export async function searchTenantKnowledge(admin: AdminClient, tenantId: string, query: string) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const [itemMatches, chunkMatches] = await Promise.all([
    searchKnowledgeItems(admin, tenantId, normalizedQuery),
    searchKnowledgeChunks(admin, tenantId, normalizedQuery),
  ])

  return [...chunkMatches, ...itemMatches]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.priority - a.priority)
    .filter(dedupeKnowledgeMatch())
    .slice(0, 5)
}

async function searchKnowledgeItems(admin: AdminClient, tenantId: string, normalizedQuery: string) {
  const { data, error } = await admin
    .from('knowledge_items')
    .select('id, source_id, question, answer, category, language, priority, metadata')
    .eq('theatre_id', tenantId)
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[knowledge] search failed', { tenantId, code: error.code, message: error.message })
    return []
  }
  if (!data) return []

  return data
    .map((item): KnowledgeMatch => ({
      ...item,
      metadata: isRecord(item.metadata) ? item.metadata : null,
      score: scoreKnowledgeItem(normalizedQuery, item),
    }))
}

async function searchKnowledgeChunks(admin: AdminClient, tenantId: string, normalizedQuery: string) {
  const { data, error } = await admin
    .from('knowledge_chunks')
    .select('id, source_id, chunk_index, content, language, metadata')
    .eq('theatre_id', tenantId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[knowledge] chunk search failed', { tenantId, code: error.code, message: error.message })
    return []
  }
  if (!data) return []

  return data.map((chunk): KnowledgeMatch => {
    const metadata = isRecord(chunk.metadata) ? chunk.metadata : null
    const question = getChunkQuestion(chunk.chunk_index, metadata)
    const item = {
      id: chunk.id,
      source_id: chunk.source_id,
      question,
      answer: chunk.content,
      category: 'documento',
      language: chunk.language,
      priority: 35,
      metadata: {
        ...(metadata ?? {}),
        source_type: getSourceType(metadata) || 'document_chunk',
        chunk_id: chunk.id,
      },
    }

    return {
      ...item,
      score: scoreKnowledgeItem(normalizedQuery, item),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getSourceType(metadata: unknown) {
  if (!isRecord(metadata)) return null
  const sourceType = metadata.source_type
  return typeof sourceType === 'string' ? sourceType : null
}

function getChunkQuestion(chunkIndex: number, metadata: Record<string, unknown> | null) {
  const fileName = metadata?.file_name
  return typeof fileName === 'string'
    ? `Documento ${fileName} · fragmento ${chunkIndex + 1}`
    : `Fragmento documental ${chunkIndex + 1}`
}

function dedupeKnowledgeMatch() {
  const seen = new Set<string>()

  return (match: KnowledgeMatch) => {
    const key = `${match.source_id ?? 'manual'}:${normalizeText(match.answer).slice(0, 180)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
}

export function shouldAnswerFromKnowledge(matches: KnowledgeMatch[]) {
  const topMatch = matches[0]
  if (!topMatch) return false

  return canAnswerDirectly(topMatch) && topMatch.score >= 8
}

function canAnswerDirectly(match: KnowledgeMatch) {
  const sourceType = getSourceType(match.metadata)
  if (sourceType === 'pdf' || sourceType === 'document_chunk') return false
  return true
}

function scoreKnowledgeItem(
  normalizedQuery: string,
  item: Pick<KnowledgeItem, 'question' | 'answer' | 'category' | 'priority'>
) {
  const question = normalizeText(item.question)
  const answer = normalizeText(item.answer)
  const category = normalizeText(item.category ?? '')
  const queryTokens = tokenize(normalizedQuery)
  if (queryTokens.length === 0) return 0

  let score = 0

  if (question === normalizedQuery) score += 20
  if (question.includes(normalizedQuery)) score += 12
  if (normalizedQuery.includes(question) && question.length > 8) score += 8

  for (const token of queryTokens) {
    if (question.includes(token)) score += 3
    if (answer.includes(token)) score += 1
    if (category.includes(token)) score += 2
  }

  score += Math.min(3, Math.max(0, item.priority) / 10)
  return score
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:()[\]{}"'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string) {
  return value
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
}

const STOPWORDS = new Set([
  'que',
  'con',
  'para',
  'por',
  'una',
  'unos',
  'unas',
  'del',
  'las',
  'los',
  'com',
  'amb',
  'per',
  'els',
  'les',
  'the',
  'and',
  'for',
])
