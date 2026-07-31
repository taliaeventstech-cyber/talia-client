export type RetrievalTraceChunk = {
  id: string | null
  source_id: string | null
  source_type: string | null
  score: number | null
  rank: number | null
  used: boolean | null
  language: string | null
  preview: string | null
}

export type RetrievalTraceAttempt = {
  attempt: number
  reason: string
  query: string
  semantic_query: string
  retrieved_count: number
  selected_count: number
  top_score: number | null
  status: string
}

export type RetrievalTrace = {
  status: string | null
  query_language: string | null
  retrieval_query: string | null
  top_score: number | null
  refinement_used: boolean
  attempts: RetrievalTraceAttempt[]
  chunks: RetrievalTraceChunk[]
}

export function summarizeRetrievalTrace(metadata: Record<string, unknown> | undefined): RetrievalTrace | null {
  if (!metadata || !isRecord(metadata.retrieval)) return null

  const retrieval = metadata.retrieval
  const chunks = Array.isArray(retrieval.chunks)
    ? retrieval.chunks
      .map((chunk, index) => summarizeRetrievalChunk(chunk, index))
      .filter((chunk): chunk is RetrievalTraceChunk => Boolean(chunk))
      .slice(0, 8)
    : []
  const attempts = Array.isArray(retrieval.attempts)
    ? retrieval.attempts
      .map(summarizeRetrievalAttempt)
      .filter((attempt): attempt is RetrievalTraceAttempt => Boolean(attempt))
      .slice(0, 3)
    : []

  return {
    status: boundedString(retrieval.status, 80),
    query_language: boundedString(retrieval.query_language, 16),
    retrieval_query: boundedString(retrieval.retrieval_query, 2_000),
    top_score: boundedNumber(retrieval.top_score, 0, 1),
    refinement_used: retrieval.refinement_used === true || attempts.some((attempt) => attempt.attempt > 0),
    attempts,
    chunks,
  }
}

function summarizeRetrievalAttempt(value: unknown): RetrievalTraceAttempt | null {
  if (!isRecord(value)) return null

  const attempt = boundedInteger(value.attempt, 0, 3)
  const reason = boundedString(value.reason, 120)
  const query = boundedString(value.query, 2_000)
  const semanticQuery = boundedString(value.semantic_query, 2_000)
  const retrievedCount = boundedInteger(value.retrieved_count, 0, 10_000)
  const selectedCount = boundedInteger(value.selected_count, 0, 100)
  const status = boundedString(value.status, 80)
  if (
    attempt === null
    || !reason
    || !query
    || !semanticQuery
    || retrievedCount === null
    || selectedCount === null
    || !status
  ) return null

  return {
    attempt,
    reason,
    query,
    semantic_query: semanticQuery,
    retrieved_count: retrievedCount,
    selected_count: selectedCount,
    top_score: boundedNumber(value.top_score, 0, 1),
    status,
  }
}

function summarizeRetrievalChunk(chunk: unknown, fallbackIndex: number): RetrievalTraceChunk | null {
  if (!isRecord(chunk)) return null

  const id = boundedString(chunk.id, 200)
  const sourceId = boundedString(chunk.source_id, 200)
  const sourceType = boundedString(chunk.source_type, 80)
  const score = boundedNumber(chunk.score, 0, 1)
  const rank = boundedInteger(chunk.rank, 1, 1_000) ?? fallbackIndex + 1
  const used = typeof chunk.used === 'boolean' ? chunk.used : null
  const language = boundedString(chunk.language, 16)
  const preview = boundedString(chunk.preview, 360)

  if (!id && !sourceId && !sourceType && !preview) return null

  return {
    id,
    source_id: sourceId,
    source_type: sourceType,
    score,
    rank,
    used,
    language,
    preview,
  }
}

function boundedString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
