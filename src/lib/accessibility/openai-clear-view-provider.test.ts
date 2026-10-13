// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { OpenAIClearViewProvider } from './openai-clear-view-provider'

describe('OpenAIClearViewProvider', () => {
  it('uses the configured regional endpoint without storing the response', async () => {
    const fetcher = vi.fn(async (
      _input: string | URL | Request,
      _init?: RequestInit,
    ) => {
      void _input
      void _init
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          title: 'Agenda clara',
          summary: ['Consulta los próximos eventos.'],
          actions: [],
          sections: [],
          warnings: [],
        }),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const provider = new OpenAIClearViewProvider(
      'test-key',
      'gpt-5.5',
      'https://eu.api.openai.com/v1/',
      fetcher as unknown as typeof fetch,
    )

    await expect(provider.generate({
      tenantId: '00000000-0000-4000-8000-000000000001',
      url: 'https://example.com/agenda',
      language: 'es',
      page: {
        title: 'Agenda',
        summary: [],
        actions: [],
        sections: [],
      },
    })).resolves.toMatchObject({ ok: true })

    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://eu.api.openai.com/v1/responses')
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
    expect(body.store).toBe(false)
  })
})
