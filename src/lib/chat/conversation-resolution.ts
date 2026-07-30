export const CHAT_CONVERSATION_RESOLUTION_STATES = [
  'active',
  'needs_clarification',
  'answered_with_evidence',
  'partially_answered',
  'handoff',
  'closed',
] as const

export type ChatConversationResolution = {
  version: 1
  state: typeof CHAT_CONVERSATION_RESOLUTION_STATES[number]
  clarificationAttempts: number
  topic?: string | null
  intent?: string | null
}

export function extractPreviousConversationResolution(
  metadata: unknown,
): ChatConversationResolution | undefined {
  if (!isRecord(metadata)) return undefined
  const agentMetadata = isRecord(metadata.agent_metadata) ? metadata.agent_metadata : metadata
  return parseConversationResolution(agentMetadata.resolution)
}

export function parseConversationResolution(value: unknown): ChatConversationResolution | undefined {
  if (!isRecord(value) || value.version !== 1 || !isResolutionState(value.state)) return undefined
  if (
    typeof value.clarification_attempts !== 'number'
    || !Number.isInteger(value.clarification_attempts)
    || value.clarification_attempts < 0
    || value.clarification_attempts > 2
  ) return undefined

  const topic = parseOptionalLabel(value.topic)
  const intent = parseOptionalLabel(value.intent)
  if (topic === undefined || intent === undefined) return undefined

  return {
    version: 1,
    state: value.state,
    clarificationAttempts: value.clarification_attempts,
    ...(topic !== null ? { topic } : {}),
    ...(intent !== null ? { intent } : {}),
  }
}

function isResolutionState(value: unknown): value is ChatConversationResolution['state'] {
  return typeof value === 'string'
    && CHAT_CONVERSATION_RESOLUTION_STATES.some((state) => state === value)
}

function parseOptionalLabel(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 48 ? normalized : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
