import type { KnowledgeRetrievalChannel } from './retrieval'
import type { KnowledgeMatch } from './service'

type TaliaAiRetrieveResponse = {
  ok?: unknown
  matches?: unknown
  error?: unknown
  details?: unknown
}

type TaliaAiMatch = {
  id?: unknown
  source_id?: unknown
  source_type?: unknown
  question?: unknown
  answer?: unknown
  category?: unknown
  priority?: unknown
  score?: unknown
  retrieval?: unknown
  language?: unknown
}

export async function retrieveKnowledgeFromTaliaAi({
  tenantId,
  query,
  channel,
  language,
}: {
  tenantId: string
  query: string
  channel: KnowledgeRetrievalChannel
  language: string
}): Promise<KnowledgeMatch[] | null> {
  const baseUrl = process.env.TALIA_AI_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.TALIA_AI_INTERNAL_API_KEY

  if (!baseUrl || !apiKey) return null

  try {
    const response = await fetch(`${baseUrl}/v1/knowledge/retrieve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        query,
        channel,
        language,
        limit: 5,
      }),
    })

    const text = await response.text()
    const body = parseResponse(text)

    if (!response.ok || body?.ok === false || !Array.isArray(body?.matches)) {
      console.warn('[knowledge] talia-ai retrieval unavailable, falling back to local search', {
        tenantId,
        status: response.status,
        error: typeof body?.error === 'string' ? body.error : undefined,
      })
      return null
    }

    return body.matches
      .map((item) => mapTaliaAiMatch(item as TaliaAiMatch, language))
      .filter((item): item is KnowledgeMatch => Boolean(item))
  } catch (error) {
    console.warn('[knowledge] talia-ai retrieval failed, falling back to local search', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function mapTaliaAiMatch(item: TaliaAiMatch, fallbackLanguage: string): KnowledgeMatch | null {
  if (typeof item.id !== 'string' || typeof item.answer !== 'string' || !item.answer.trim()) return null

  const sourceType = typeof item.source_type === 'string' ? item.source_type : 'knowledge_item'
  const score = typeof item.score === 'number' && Number.isFinite(item.score)
    ? Math.max(0, Math.min(20, item.score * 20))
    : 0

  return {
    id: item.id,
    source_id: typeof item.source_id === 'string' ? item.source_id : null,
    question: typeof item.question === 'string' ? item.question : '',
    answer: item.answer,
    category: typeof item.category === 'string' ? item.category : null,
    language: typeof item.language === 'string' ? item.language : fallbackLanguage,
    priority: typeof item.priority === 'number' && Number.isFinite(item.priority) ? item.priority : 0,
    metadata: {
      source_type: sourceType,
      remote_provider: 'talia-ai',
      retrieval: typeof item.retrieval === 'string' ? item.retrieval : 'unknown',
      remote_score: typeof item.score === 'number' ? item.score : null,
    },
    score,
  }
}

function parseResponse(text: string): TaliaAiRetrieveResponse | null {
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
