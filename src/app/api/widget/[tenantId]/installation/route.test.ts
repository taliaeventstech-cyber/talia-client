import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { POST } from './route'

const rpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ rpc })),
}))

vi.mock('@/lib/widget/domain-allowlist', () => ({
  getTenantWidgetDomainSettings: vi.fn(),
  validateWidgetRequestDomain: vi.fn(),
}))

describe('POST /api/widget/[tenantId]/installation', () => {
  beforeEach(() => {
    rpc.mockReset()
    vi.mocked(getTenantWidgetDomainSettings).mockResolvedValue({
      ok: true,
      settings: { websiteUrl: 'https://example.com', widgetConfig: {} },
    })
  })

  it('records a heartbeat for an authorized widget origin', async () => {
    vi.mocked(validateWidgetRequestDomain).mockReturnValue({
      ok: true,
      requestHost: 'example.com',
      pageHost: null,
      authorizedHosts: ['example.com'],
    })
    rpc.mockResolvedValue({ data: true, error: null })

    const response = await POST(new Request(
      'https://agora.talia.events/api/widget/tenant-1/installation',
      { method: 'POST', headers: { Origin: 'https://example.com' } },
    ), { params: Promise.resolve({ tenantId: 'tenant-1' }) })

    expect(response.status).toBe(204)
    expect(rpc).toHaveBeenCalledWith('record_widget_installation', {
      p_theatre_id: 'tenant-1',
      p_origin: 'https://example.com',
    })
  })

  it('rejects an unauthorized origin without writing a heartbeat', async () => {
    vi.mocked(validateWidgetRequestDomain).mockReturnValue({
      ok: false,
      error: 'domain_not_allowed',
      requestHost: 'attacker.example',
      pageHost: null,
      authorizedHosts: ['example.com'],
    })

    const response = await POST(new Request(
      'https://agora.talia.events/api/widget/tenant-1/installation',
      { method: 'POST', headers: { Origin: 'https://attacker.example' } },
    ), { params: Promise.resolve({ tenantId: 'tenant-1' }) })

    expect(response.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })
})
