import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestWebSnapshotSource, registerInstalledWebPage } from '@/lib/knowledge/ingestion'
import { getPublicWidgetConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import { POST } from './route'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/knowledge/ingestion', () => ({
  ingestWebSnapshotSource: vi.fn(),
  registerInstalledWebPage: vi.fn(),
}))

vi.mock('@/lib/tenants/service', () => ({
  getPublicWidgetConfig: vi.fn(),
}))

vi.mock('@/lib/widget/domain-allowlist', () => ({
  getTenantWidgetDomainSettings: vi.fn(),
  validateWidgetRequestDomain: vi.fn(),
}))

const requestBody = {
  url: 'https://example.com/programacion',
  title: 'Programación',
  text: 'Contenido público suficientemente largo para poder procesar esta página.',
}

describe('POST /api/widget/[tenantId]/installed-page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTenantWidgetDomainSettings).mockResolvedValue({
      ok: true,
      settings: { websiteUrl: 'https://example.com', widgetConfig: {} },
    })
    vi.mocked(validateWidgetRequestDomain).mockReturnValue({
      ok: true,
      requestHost: 'example.com',
      pageHost: 'example.com',
      authorizedHosts: ['example.com'],
    })
    vi.mocked(registerInstalledWebPage).mockResolvedValue({
      ok: true,
      message: 'registered',
      sourceId: 'source-1',
      documentId: 'page-1',
    })
    vi.mocked(ingestWebSnapshotSource).mockResolvedValue({ ok: true, message: 'processed', count: 3 })
  })

  it('does not register pages until detection is enabled', async () => {
    mockCaptureSettings(false, 'manual')

    const response = await postInstalledPage(requestBody)

    expect(response.status).toBe(403)
    expect(registerInstalledWebPage).not.toHaveBeenCalled()
  })

  it('registers without processing in manual mode', async () => {
    mockCaptureSettings(true, 'manual')

    const response = await postInstalledPage(requestBody)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ processed: false })
    expect(ingestWebSnapshotSource).not.toHaveBeenCalled()
  })

  it('registers and processes visible content in automatic mode', async () => {
    mockCaptureSettings(true, 'automatic')

    const response = await postInstalledPage(requestBody)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ processed: true, chunks: 3, page_id: 'page-1' })
    expect(ingestWebSnapshotSource).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      documentId: 'page-1',
      captureMode: 'automatic',
    }))
  })
})

function mockCaptureSettings(enabled: boolean, mode: 'manual' | 'automatic') {
  vi.mocked(getPublicWidgetConfig).mockResolvedValue({
    ok: true,
    config: { installedWebCapture: { enabled, mode } },
  } as Awaited<ReturnType<typeof getPublicWidgetConfig>>)
}

function postInstalledPage(body: unknown) {
  return POST(
    new Request('https://agora.talia.events/api/widget/tenant-1/installed-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ tenantId: 'tenant-1' }) },
  )
}
