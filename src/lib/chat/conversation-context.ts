export type ChatConversationContextMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ConversationContextRow = {
  role?: unknown
  content?: unknown
}

type ConversationContextLimits = {
  maxMessages?: number
  maxMessageCharacters?: number
  maxTotalCharacters?: number
}

export const CONVERSATION_CONTEXT_LIMITS = {
  maxMessages: 6,
  maxMessageCharacters: 2_000,
  maxTotalCharacters: 6_000,
} as const

export function boundConversationContext(
  newestFirstRows: ConversationContextRow[],
  limits: ConversationContextLimits = {},
): ChatConversationContextMessage[] {
  const maxMessages = clampPositiveInteger(
    limits.maxMessages,
    CONVERSATION_CONTEXT_LIMITS.maxMessages,
  )
  const maxMessageCharacters = clampPositiveInteger(
    limits.maxMessageCharacters,
    CONVERSATION_CONTEXT_LIMITS.maxMessageCharacters,
  )
  const maxTotalCharacters = clampPositiveInteger(
    limits.maxTotalCharacters,
    CONVERSATION_CONTEXT_LIMITS.maxTotalCharacters,
  )
  const selected: ChatConversationContextMessage[] = []
  let totalCharacters = 0

  for (const row of newestFirstRows) {
    if (selected.length >= maxMessages) break
    if (row.role !== 'user' && row.role !== 'assistant') continue
    if (typeof row.content !== 'string') continue
    const normalized = row.content.trim()
    if (!normalized) continue

    const remainingCharacters = maxTotalCharacters - totalCharacters
    if (remainingCharacters <= 0) break
    const content = normalized.slice(0, Math.min(maxMessageCharacters, remainingCharacters))
    if (!content) break

    selected.push({ role: row.role, content })
    totalCharacters += content.length
  }

  return selected.reverse()
}

function clampPositiveInteger(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback
}
