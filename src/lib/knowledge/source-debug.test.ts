import { describe, expect, it } from 'vitest'
import { buildKnowledgeSourceDebugPayload, getKnowledgeSourceDebugFilename, hasKnowledgeSourceDebugData } from './source-debug'

const source = {
  id: 'source-123',
  type: 'url',
  name: 'Programación',
  status: 'error',
  syncEnabled: true,
  sourceUrl: 'https://example.org/agenda?access_token=private&view=all',
  refreshInterval: 'daily',
  nextSyncAt: null,
  lastSyncedAt: '2026-08-01T10:00:00.000Z',
  lastError: 'talia-ai responded with 502',
  documentCount: 0,
  chunkCount: 0,
  embeddingCounts: { ready: 0, pending: 0, processing: 0, error: 0 },
  latestSyncRun: {
    status: 'failed',
    discovered_count: 1,
    checked_count: 1,
    changed_count: 0,
    unchanged_count: 0,
    failed_count: 1,
    blocked_count: 0,
    error_code: 'upstream_502',
    error_details: 'The indexing service was unavailable.',
    metadata: {
      request_id: 'request-1',
      authorization: 'Bearer private',
      nested: { api_key: 'private', url: 'https://example.org/path?token=private' },
    },
    created_at: '2026-08-01T10:00:00.000Z',
    finished_at: '2026-08-01T10:01:00.000Z',
  },
}

describe('knowledge source debug payload', () => {
  it('includes diagnostic context while redacting credential-like fields', () => {
    expect(buildKnowledgeSourceDebugPayload(source, '2026-08-02T10:00:00.000Z')).toMatchObject({
      schema: 'talia.knowledge-source-debug/v1',
      generated_at: '2026-08-02T10:00:00.000Z',
      source: {
        id: 'source-123',
        last_error: 'talia-ai responded with 502',
        source_url: 'https://example.org/agenda?access_token=%5Bredacted%5D&view=all',
      },
      latest_sync_run: {
        error_code: 'upstream_502',
        metadata: {
          authorization: '[redacted]',
          nested: {
            api_key: '[redacted]',
            url: 'https://example.org/path?token=%5Bredacted%5D',
          },
        },
      },
    })
  })

  it('only exposes the download action for sources with diagnostic errors', () => {
    expect(hasKnowledgeSourceDebugData(source)).toBe(true)
    expect(hasKnowledgeSourceDebugData({
      ...source,
      status: 'ready',
      lastError: null,
      latestSyncRun: null,
    })).toBe(false)
  })

  it('uses a stable, source-scoped filename', () => {
    expect(getKnowledgeSourceDebugFilename('source-123')).toBe('talia-knowledge-debug-source-123.json')
  })
})
