// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { processJobs } = vi.hoisted(() => ({ processJobs: vi.fn() }))
vi.mock('@/lib/instagram/processor', () => ({ processInstagramInboundJobs: processJobs }))

import { GET, POST } from './route'

afterEach(() => {
  vi.unstubAllEnvs()
  processJobs.mockReset()
})

describe('Instagram processor route', () => {
  it('accepts Vercel cron bearer auth and bounds the batch size', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-with-at-least-32-characters')
    processJobs.mockResolvedValue({
      claimed: 1, responded: 1, handoffs: 0, retried: 0, deferred: 0, failed: 0,
    })

    const response = await GET(new NextRequest('http://localhost/api/cron/instagram/process?limit=200', {
      headers: { authorization: 'Bearer cron-secret-with-at-least-32-characters' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, claimed: 1, responded: 1 })
    expect(processJobs).toHaveBeenCalledWith(undefined, { limit: 3 })
  })

  it('allows a manual wake-up only with the internal key', async () => {
    vi.stubEnv('INTERNAL_API_KEY', 'internal-secret-with-at-least-32-characters')
    processJobs.mockResolvedValue({
      claimed: 0, responded: 0, handoffs: 0, retried: 0, deferred: 0, failed: 0,
    })

    const unauthorized = await POST(new NextRequest('http://localhost/api/cron/instagram/process', { method: 'POST' }))
    const authorized = await POST(new NextRequest('http://localhost/api/cron/instagram/process', {
      method: 'POST',
      headers: { 'x-internal-api-key': 'internal-secret-with-at-least-32-characters' },
    }))

    expect(unauthorized.status).toBe(401)
    expect(authorized.status).toBe(200)
  })
})
