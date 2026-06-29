// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ingestKnowledgeTextWithTaliaAi } from './talia-ai-ingestion'

describe('ingestKnowledgeTextWithTaliaAi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete process.env.TALIA_AI_BASE_URL
    delete process.env.TALIA_AI_INTERNAL_API_KEY
  })

  it('returns null when talia-ai is not configured', async () => {
    await expect(ingestKnowledgeTextWithTaliaAi({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      sourceType: 'pdf',
      text: 'Contenido',
      metadata: {},
    })).resolves.toBeNull()
  })

  it('calls talia-ai ingestion endpoint', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, source_id: 'source-1', chunks: 4 }),
    }))

    const result = await ingestKnowledgeTextWithTaliaAi({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      sourceType: 'pdf',
      text: 'Texto normalizado del PDF',
      metadata: { file_name: 'info.pdf', language: 'es' },
    })

    expect(result).toEqual({ ok: true, sourceId: 'source-1', chunks: 4 })
    expect(fetch).toHaveBeenCalledWith(
      'https://talia-ai.example.test/v1/knowledge/ingest',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
        }),
        body: JSON.stringify({
          tenant_id: 'tenant-1',
          source_id: 'source-1',
          source_type: 'pdf',
          text: 'Texto normalizado del PDF',
          metadata: { file_name: 'info.pdf', language: 'es' },
        }),
      }),
    )
  })

  it('can send a private storage reference instead of text', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, source_id: 'source-1', chunks: 4 }),
    }))

    await ingestKnowledgeTextWithTaliaAi({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      sourceType: 'pdf',
      storage: { bucket: 'knowledge-files', path: 'tenant-1/source-1/info.pdf' },
      metadata: { file_name: 'info.pdf', language: 'es' },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      tenant_id: 'tenant-1',
      source_id: 'source-1',
      source_type: 'pdf',
      storage: { bucket: 'knowledge-files', path: 'tenant-1/source-1/info.pdf' },
      metadata: { file_name: 'info.pdf', language: 'es' },
    })
  })

  it('can send a URL source for remote ingestion', async () => {
    process.env.TALIA_AI_BASE_URL = 'https://talia-ai.example.test/'
    process.env.TALIA_AI_INTERNAL_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, source_id: 'source-url', chunks: 2 }),
    }))

    await ingestKnowledgeTextWithTaliaAi({
      tenantId: 'tenant-1',
      sourceId: 'source-url',
      sourceType: 'url',
      url: 'https://example.org/programacion',
      metadata: { source_url: 'https://example.org/programacion', language: 'es' },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      tenant_id: 'tenant-1',
      source_id: 'source-url',
      source_type: 'url',
      url: 'https://example.org/programacion',
      metadata: { source_url: 'https://example.org/programacion', language: 'es' },
    })
  })
})
