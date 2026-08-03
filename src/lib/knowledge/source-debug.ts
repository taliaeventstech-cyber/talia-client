export type DebuggableSource = {
  id: string
  type: string
  name: string
  status: string
  syncEnabled: boolean
  sourceUrl: string | null
  refreshInterval: string
  nextSyncAt: string | null
  lastSyncedAt: string | null
  lastError: string | null
  documentCount: number
  chunkCount: number
  embeddingCounts: {
    ready: number
    pending: number
    processing: number
    error: number
  }
  latestSyncRun: {
    status: string
    discovered_count: number
    checked_count: number
    changed_count: number
    unchanged_count: number
    failed_count: number
    blocked_count: number
    error_code: string | null
    error_details: string | null
    metadata: unknown
    created_at: string
    finished_at: string | null
  } | null
}

const SENSITIVE_FIELD_NAME = /authorization|api[_-]?key|secret|token|password|cookie|credential|session/i
const URL_FIELD_NAME = /url|uri|link|endpoint/i

export function hasKnowledgeSourceDebugData(source: DebuggableSource) {
  return source.status === 'error'
    || Boolean(source.lastError)
    || source.embeddingCounts.error > 0
    || source.latestSyncRun?.status === 'failed'
    || Boolean(source.latestSyncRun?.error_code)
}

export function buildKnowledgeSourceDebugPayload(source: DebuggableSource, generatedAt = new Date().toISOString()) {
  return {
    schema: 'talia.knowledge-source-debug/v1',
    generated_at: generatedAt,
    source: {
      id: source.id,
      type: source.type,
      name: source.name,
      status: source.status,
      source_url: sanitizeUrl(source.sourceUrl),
      sync_enabled: source.syncEnabled,
      refresh_interval: source.refreshInterval,
      next_sync_at: source.nextSyncAt,
      last_synced_at: source.lastSyncedAt,
      last_error: source.lastError,
    },
    processing: {
      documents: source.documentCount,
      chunks: source.chunkCount,
      embeddings: source.embeddingCounts,
    },
    latest_sync_run: source.latestSyncRun
      ? {
          status: source.latestSyncRun.status,
          created_at: source.latestSyncRun.created_at,
          finished_at: source.latestSyncRun.finished_at,
          counters: {
            discovered: source.latestSyncRun.discovered_count,
            checked: source.latestSyncRun.checked_count,
            changed: source.latestSyncRun.changed_count,
            unchanged: source.latestSyncRun.unchanged_count,
            failed: source.latestSyncRun.failed_count,
            blocked: source.latestSyncRun.blocked_count,
          },
          error_code: source.latestSyncRun.error_code,
          error_details: source.latestSyncRun.error_details,
          metadata: sanitizeDebugValue(source.latestSyncRun.metadata),
        }
      : null,
  }
}

export function getKnowledgeSourceDebugFilename(sourceId: string) {
  return `talia-knowledge-debug-${sourceId}.json`
}

function sanitizeDebugValue(value: unknown, fieldName = ''): unknown {
  if (SENSITIVE_FIELD_NAME.test(fieldName)) return '[redacted]'
  if (typeof value === 'string') return URL_FIELD_NAME.test(fieldName) ? sanitizeUrl(value) : value
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((item) => sanitizeDebugValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeDebugValue(item, key)]),
    )
  }

  return value === undefined ? null : String(value)
}

function sanitizeUrl(value: string | null) {
  if (!value) return value

  try {
    const url = new URL(value)
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_FIELD_NAME.test(key)) url.searchParams.set(key, '[redacted]')
    }
    return url.toString()
  } catch {
    return value
  }
}
