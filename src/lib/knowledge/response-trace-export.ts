import type { Json } from '@/types/database.types'

export type ResponseTraceExport = {
  schema_version: 'talia.response_trace.v1'
  exported_at: string
  venue: {
    id: string
    name: string
  }
  response: {
    message_id: string
    conversation_id: string
    created_at: string
    question: string | null
    answer: string
  }
  provider: {
    requested: string | null
    used: string
    model: string | null
  }
  language: {
    response_language: string | null
    agent: Json | null
  }
  retrieval: {
    status: string | null
    low_confidence: boolean
    fallback_reason: string | null
    sources: Json[]
    chunks: Json[]
    context_assembly: Json | null
  }
  feedback: {
    response: Json | null
    session: Json | null
  }
  metadata: Json
}

export function buildResponseTraceExport(input: Omit<ResponseTraceExport, 'schema_version' | 'exported_at'> & {
  exportedAt?: string
}): ResponseTraceExport {
  const { exportedAt, ...trace } = input

  return {
    schema_version: 'talia.response_trace.v1',
    exported_at: exportedAt ?? new Date().toISOString(),
    ...trace,
  }
}

export function buildResponseTraceFilename(createdAt: string, messageId: string) {
  const parsedDate = new Date(createdAt)
  const date = Number.isNaN(parsedDate.getTime())
    ? 'unknown-date'
    : parsedDate.toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-')
  const shortMessageId = messageId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12) || 'response'
  return `talia-response-trace_${date}_${shortMessageId}.json`
}
