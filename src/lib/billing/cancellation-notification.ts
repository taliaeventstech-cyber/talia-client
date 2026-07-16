type BillingCancellationNotification = {
  accountName: string
  billingEmail: string | null
  mode: 'period_end' | 'immediate'
  effectiveAt: string | null
}

export type BillingCancellationNotificationResult =
  | { status: 'sent'; providerId: string | null }
  | { status: 'skipped' | 'failed'; error: string }

export async function sendBillingCancellationNotification(
  input: BillingCancellationNotification,
  options: {
    fetchImpl?: typeof fetch
    apiKey?: string
    from?: string
  } = {},
): Promise<BillingCancellationNotificationResult> {
  if (!input.billingEmail) return { status: 'skipped', error: 'billing_email_missing' }

  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY
  const from = options.from ?? process.env.TALIA_BILLING_FROM_EMAIL ?? process.env.TALIA_SUPPORT_FROM_EMAIL
  if (!apiKey || !from) return { status: 'skipped', error: 'billing_email_not_configured' }

  const effectiveDate = input.effectiveAt
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'Europe/Madrid' }).format(new Date(input.effectiveAt))
    : null
  const timing = input.mode === 'immediate'
    ? 'La suscripción se ha cancelado con efecto inmediato.'
    : `La renovación se ha cancelado${effectiveDate ? ` y el servicio seguirá activo hasta el ${effectiveDate}` : ' y el servicio seguirá activo hasta el final del periodo contratado'}.`

  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.billingEmail],
        subject: `Cancelación de la suscripción de ${input.accountName}`,
        text: [
          `Hola,`,
          '',
          `Te confirmamos un cambio administrativo en la suscripción de ${input.accountName}.`,
          timing,
          '',
          'Si no esperabas este cambio, responde a este correo para contactar con el equipo de TALIA.',
        ].join('\n'),
      }),
    })

    if (!response.ok) return { status: 'failed', error: `billing_email_provider_${response.status}` }
    const payload = await response.json().catch(() => null) as { id?: unknown } | null
    return { status: 'sent', providerId: typeof payload?.id === 'string' ? payload.id : null }
  } catch {
    return { status: 'failed', error: 'billing_email_delivery_failed' }
  }
}
