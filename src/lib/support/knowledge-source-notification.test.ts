import { describe, expect, it, vi } from 'vitest'
import { sendKnowledgeSourceSupportNotification } from './knowledge-source-notification'

const context = {
  requestId: 'request-1',
  tenantId: 'tenant-1',
  tenantName: 'Sala Test',
  sourceId: 'source-1',
  sourceName: 'Web principal',
  sourceUrl: 'https://example.com/',
  runId: 'run-1',
  errorCode: 'discovery_incomplete',
  requesterEmail: 'owner@example.com',
  customerMessage: 'Necesito ayuda para completar la captura.',
}

describe('knowledge source support notifications', () => {
  it('keeps the request pending when email delivery is not configured', async () => {
    await expect(sendKnowledgeSourceSupportNotification(context, {
      apiKey: '',
      from: '',
      to: '',
    })).resolves.toEqual({ status: 'pending', error: 'support_email_not_configured' })
  })

  it('sends bounded operational context without captured knowledge', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(payload).toMatchObject({
        from: 'support@talia.events',
        to: ['ops@talia.events'],
        reply_to: 'owner@example.com',
      })
      expect(String(payload.text)).toContain('Error code: discovery_incomplete')
      expect(String(payload.text)).toContain('Necesito ayuda para completar la captura.')
      expect(String(payload.text)).not.toContain('chunk')
      return Response.json({ id: 'email-1' })
    })

    await expect(sendKnowledgeSourceSupportNotification(context, {
      fetchImpl,
      apiKey: 'secret',
      from: 'support@talia.events',
      to: 'ops@talia.events',
    })).resolves.toEqual({ status: 'sent', providerId: 'email-1' })
  })

  it('returns a bounded failure without leaking the provider response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('sensitive provider error', { status: 503 }))

    await expect(sendKnowledgeSourceSupportNotification(context, {
      fetchImpl,
      apiKey: 'secret',
      from: 'support@talia.events',
      to: 'ops@talia.events',
    })).resolves.toEqual({ status: 'failed', error: 'support_email_provider_503' })
  })
})
