import type { createAdminClient } from '@/lib/supabase/admin'
import { searchTenantKnowledge, shouldAnswerFromKnowledge, type KnowledgeMatch } from './service'
import { retrieveKnowledgeFromTaliaAi } from './talia-ai-retrieval'

type AdminClient = ReturnType<typeof createAdminClient>

export type KnowledgeRetrievalChannel = 'web' | 'email' | 'voice'

export type KnowledgeRetrievalResult = {
  query: string
  channel: KnowledgeRetrievalChannel
  matches: KnowledgeMatch[]
  topMatch: KnowledgeMatch | null
  shouldAnswerDirectly: boolean
}

export type RelevantKnowledgeHint = {
  id: string
  sourceId: string | null
  sourceType: string
  question: string
  answer: string
  category: string | null
  priority: number
  score: number
}

export async function retrieveTenantKnowledge({
  admin,
  tenantId,
  query,
  channel,
  language,
}: {
  admin: AdminClient
  tenantId: string
  query: string
  channel: KnowledgeRetrievalChannel
  language: string
}): Promise<KnowledgeRetrievalResult> {
  if (!shouldRetrieveKnowledge(query)) {
    return {
      query,
      channel,
      matches: [],
      topMatch: null,
      shouldAnswerDirectly: false,
    }
  }

  const remoteMatches = shouldUseTaliaAiRetrieval()
    ? await retrieveKnowledgeFromTaliaAi({ tenantId, query, channel, language })
    : null
  const matches = remoteMatches ?? await searchTenantKnowledge(admin, tenantId, query)

  return {
    query,
    channel,
    matches,
    topMatch: matches[0] ?? null,
    shouldAnswerDirectly: shouldAnswerFromKnowledge(matches),
  }
}

function shouldUseTaliaAiRetrieval() {
  return process.env.KNOWLEDGE_RETRIEVAL_PROVIDER === 'talia-ai' || process.env.CHAT_AGENT_PROVIDER === 'talia-ai'
}

export function shouldRetrieveKnowledge(query: string) {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return false
  if (tokens.length <= 2 && tokens.every((token) => LOW_INTENT_TOKENS.has(token))) return false
  return true
}

const MIN_AGENT_CONTEXT_SCORE = 4

export function buildRelevantKnowledgeHints(matches: KnowledgeMatch[], limit = 3): RelevantKnowledgeHint[] {
  const strongMatches = matches.filter((match) => match.score >= MIN_AGENT_CONTEXT_SCORE)
  const selectedMatches = strongMatches.length ? strongMatches : matches.slice(0, 1)

  return selectedMatches.slice(0, limit).map((match) => ({
    id: match.id,
    sourceId: match.source_id,
    sourceType: getSourceType(match),
    question: match.question,
    answer: match.answer,
    category: match.category,
    priority: match.priority,
    score: match.score,
  }))
}

function getSourceType(match: KnowledgeMatch) {
  const sourceType = match.metadata?.source_type
  return typeof sourceType === 'string' ? sourceType : 'knowledge_item'
}

function tokenizeQuery(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:()[\]{}"'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token.length > 1)
}

const LOW_INTENT_TOKENS = new Set([
  'hola',
  'ola',
  'hello',
  'hi',
  'hey',
  'bones',
  'buenas',
  'bon',
  'dia',
  'buenos',
  'dias',
  'bona',
  'tarda',
  'noches',
  'nit',
  'gracias',
  'merci',
  'thanks',
  'ok',
  'vale',
])
