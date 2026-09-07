import type { Json } from '@/types/database.types'
import { summarizeRetrievalTrace } from '@/lib/chat/retrieval-trace'
import { sanitizeDiagnosticValue } from './report'

const AGENT_METADATA_KEYS = [
  'answer_agent_failure',
  'clarification_resolution',
  'context_assembly',
  'evidence',
  'fallback',
  'grounding_gate',
  'language_agent',
  'location_action',
  'purchase_action',
  'resolution',
  'semantic_policy',
  'temporal_query',
] as const

export function buildResponseDiagnosticArtifact(input: {
  content: string
  createdAt: string
  metadata: Json
  conversationMetadata?: Json | null
}) {
  const metadata = getRecord(input.metadata)
  const agentMetadata = getRecord(metadata.agent_metadata)
  const selectedAgentMetadata = Object.fromEntries(
    AGENT_METADATA_KEYS.flatMap((key) => key in agentMetadata ? [[key, agentMetadata[key]]] : []),
  )

  return sanitizeDiagnosticValue({
    response: {
      created_at: input.createdAt,
      question: boundedString(metadata.user_message, 10_000),
      answer: input.content.slice(0, 20_000),
      page_url: boundedString(metadata.page_url, 2_000),
    },
    provider: {
      requested: boundedString(metadata.requested_provider, 80),
      used: boundedString(metadata.source, 80),
      model: boundedString(metadata.model, 120),
    },
    language: {
      response_language: boundedString(metadata.response_language, 16),
      tenant_fallback_language: boundedString(metadata.tenant_fallback_language, 16),
    },
    signals: {
      retrieval_status: boundedString(metadata.retrieval_status, 80),
      low_confidence: metadata.low_confidence === true,
      fallback_reason: boundedString(metadata.fallback_reason, 120),
      response_feedback: metadata.feedback ?? null,
      conversation_feedback: getRecord(input.conversationMetadata).feedback ?? null,
    },
    retrieval: summarizeRetrievalTrace(metadata),
    agent_metadata: selectedAgentMetadata,
  }) as Record<string, unknown>
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.slice(0, maxLength) : null
}
