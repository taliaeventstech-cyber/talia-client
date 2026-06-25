// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { embedKnowledgeSourceWithTaliaAi } from './talia-ai-embeddings'

describe('embedKnowledgeSourceWithTaliaAi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete process.env.TALIA_AI_BASE_URL
    delete process.env.TALIA_AI_INTERNAL_API_KEY
  })

  it('returns null when talia-ai is not configured', async () => {
    await expect(embedKnowledgeSourceWithTaliaAi({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      limit: 3,
    })).resolves.toBeNull()
  })

  it('calls talia-ai embedding endpoint for a source', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, checked: 3, embedded: 3, failed: 0, skipped: 0 }),
    }))

    const result = await embedKnowledgeSourceWithTaliaAi({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      limit: 3,
    })

    expect(result).toEqual({ ok: true, checked: 3, embedded: 3, failed: 0, skipped: 0 })
    expect(fetch).toHaveBeenCalledWith(
      'https://talia-ai.example.test/v1/knowledge/embed',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
        }),
        body: JSON.stringify({
          tenant_id: 'tenant-1',
          source_id: 'source-1',
          limit: 3,
          retry_errors: false,
        }),
      }),
    )
  })
})
