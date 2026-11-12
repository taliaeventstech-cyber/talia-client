// Post-processing shared by the public chat route and the Agora test chat,
// so both answer exactly the same way.

import type { ChatAgentPendingClarification } from '@/lib/agent-runtime/chat'
import type { Json } from '@/types/database.types'

export type AgentSourceSummary = {
  id: string | null
  source_id: string | null
  source_type: string | null
  score: number | null
  title?: string
  url?: string
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function enforceAllowedContactEmails(
  reply: string,
  config: { fallbackEmail: string | null; fallbackContacts: boolean }
) {
  const allowedEmails = config.fallbackContacts && config.fallbackEmail
    ? [config.fallbackEmail.trim().toLowerCase()]
    : []
  const fallback = allowedEmails[0]
  const redactedEmails = new Set<string>()

  const safeReply = reply.replace(EMAIL_PATTERN, (match) => {
    const normalized = match.trim().toLowerCase()
    if (allowedEmails.includes(normalized)) return match
    redactedEmails.add(normalized)
    return fallback ?? 'el contacto oficial configurado'
  })

  return {
    reply: safeReply,
    allowedEmails,
    redactedEmails: Array.from(redactedEmails),
  }
}

export function summarizeAgentSources(sources: unknown[] | undefined): AgentSourceSummary[] {
  if (!Array.isArray(sources)) return []

  return sources
    .map((source) => {
      if (!isRecord(source)) return null
      const id = typeof source.id === 'string' ? source.id : null
      const sourceId = typeof source.source_id === 'string' ? source.source_id : null
      const sourceType = typeof source.source_type === 'string' ? source.source_type : null
      const score = typeof source.score === 'number' && Number.isFinite(source.score) ? source.score : null
      const title = typeof source.title === 'string' && source.title.trim() ? source.title.trim().slice(0, 160) : undefined
      const url = normalizeOfficialWebSourceUrl(source.url, sourceType)
      if (!id && !sourceId && !sourceType) return null
      return {
        id,
        source_id: sourceId,
        source_type: sourceType,
        score,
        ...(title ? { title } : {}),
        ...(url ? { url } : {}),
      } satisfies AgentSourceSummary
    })
    .filter((source): source is AgentSourceSummary => Boolean(source))
    .slice(0, 8)
}

function normalizeOfficialWebSourceUrl(value: unknown, sourceType: string | null) {
  if (sourceType !== 'official_web_search' || typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && value.length <= 2_000
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

export function extractPendingClarification(metadata: Json | undefined): ChatAgentPendingClarification | undefined {
  if (!isRecord(metadata)) return undefined
  const agentMetadata = isRecord(metadata.agent_metadata) ? metadata.agent_metadata : metadata
  if (agentMetadata.action !== 'clarification_requested') return undefined

  const clarification = isRecord(agentMetadata.clarification) ? agentMetadata.clarification : null
  if (!clarification || !isClarificationIntent(clarification.intent)) return undefined

  const options = Array.isArray(clarification.options)
    ? clarification.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0).slice(0, 8)
    : []
  if (options.length === 0) return undefined

  const optionKeys = Array.isArray(clarification.option_keys)
    ? clarification.option_keys.filter((option): option is string => typeof option === 'string' && option.trim().length > 0).slice(0, options.length)
    : undefined

  return {
    intent: clarification.intent,
    ...(typeof clarification.reason === 'string' ? { reason: clarification.reason } : {}),
    options,
    ...(optionKeys?.length ? { optionKeys } : {}),
  }
}

export function serializePendingClarification(value: ChatAgentPendingClarification): Json {
  return {
    intent: value.intent,
    reason: value.reason ?? null,
    options: value.options,
    option_keys: value.optionKeys ?? [],
  }
}

function isClarificationIntent(value: unknown): value is ChatAgentPendingClarification['intent'] {
  return value === 'pricing' || value === 'schedule' || value === 'program'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
