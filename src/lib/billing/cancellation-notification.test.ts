import { describe, expect, it, vi } from 'vitest'
import { sendBillingCancellationNotification } from './cancellation-notification'

describe('billing cancellation notification', () => {
  it('does not block cancellation when billing email is unavailable', async () => {
    await expect(sendBillingCancellationNotification({
      accountName: 'Sala Test',
      billingEmail: null,
      mode: 'period_end',
      effectiveAt: null,
    })).resolves.toEqual({ status: 'skipped', error: 'billing_email_missing' })
  })

  it('notifies the billing contact without exposing the internal reason', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(payload).toMatchObject({
        to: ['billing@example.com'],
        subject: 'Cancelación de la suscripción de Sala Test',
      })
      expect(String(payload.text)).toContain('seguirá activo')
      expect(String(payload.text)).not.toContain('internal reason')
      return Response.json({ id: 'email-1' })
    })

    await expect(sendBillingCancellationNotification({
      accountName: 'Sala Test',
      billingEmail: 'billing@example.com',
      mode: 'period_end',
      effectiveAt: '2026-08-15T00:00:00.000Z',
    }, {
      fetchImpl,
      apiKey: 'secret',
      from: 'billing@talia.events',
    })).resolves.toEqual({ status: 'sent', providerId: 'email-1' })
  })
})
