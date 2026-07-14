import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicWidgetConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { GET } from './route'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/tenants/service', () => ({
  getPublicWidgetConfig: vi.fn(),
}))

vi.mock('@/lib/widget/domain-allowlist', () => ({
  getTenantWidgetDomainSettings: vi.fn(),
  validateWidgetRequestDomain: vi.fn(),
}))

describe('GET /api/widget/[tenantId]', () => {
  beforeEach(() => {
    vi.mocked(getTenantWidgetDomainSettings).mockResolvedValue({
      ok: true,
      settings: {
        websiteUrl: 'https://example.com',
        widgetConfig: {},
      },
    })
    vi.mocked(validateWidgetRequestDomain).mockReturnValue({
      ok: true,
      requestHost: 'example.com',
      pageHost: null,
      authorizedHosts: ['example.com'],
    })
  })

  it('does not expose configuration for a disabled chatbot', async () => {
    vi.mocked(getPublicWidgetConfig).mockResolvedValue({
      ok: true,
      config: { enabled: false },
    } as Awaited<ReturnType<typeof getPublicWidgetConfig>>)

    const response = await GET(
      new Request('https://agora.talia.events/api/widget/tenant-1'),
      { params: Promise.resolve({ tenantId: 'tenant-1' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Chatbot is disabled' })
  })
})
