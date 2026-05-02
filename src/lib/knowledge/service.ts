import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type KnowledgeItem = {
  id: string
  question: string
  answer: string
  category: string | null
  language: string
  priority: number
}

export type KnowledgeMatch = KnowledgeItem & {
  score: number
}

export async function searchTenantKnowledge(admin: AdminClient, tenantId: string, query: string) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const { data, error } = await admin
    .from('knowledge_items')
    .select('id, question, answer, category, language, priority')
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
    .map((item) => ({
      ...item,
      score: scoreKnowledgeItem(normalizedQuery, item),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.priority - a.priority)
    .slice(0, 5)
}

export function shouldAnswerFromKnowledge(matches: KnowledgeMatch[]) {
  return (matches[0]?.score ?? 0) >= 8
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
