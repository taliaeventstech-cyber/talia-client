type KnowledgeSourceSupportContext = {
  requestId: string
  tenantId: string
  tenantName: string
  sourceId: string
  sourceName: string
  sourceUrl: string | null
  runId: string | null
  errorCode: string | null
  requesterEmail: string | null
  customerMessage: string
}

type NotificationResult =
  | { status: 'sent'; providerId: string | null }
  | { status: 'pending' | 'failed'; error: string }

export async function sendKnowledgeSourceSupportNotification(
  context: KnowledgeSourceSupportContext,
  options: {
    fetchImpl?: typeof fetch
    apiKey?: string
    from?: string
    to?: string
  } = {}
): Promise<NotificationResult> {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY
  const from = options.from ?? process.env.TALIA_SUPPORT_FROM_EMAIL
  const to = options.to ?? process.env.TALIA_SUPPORT_EMAIL
  if (!apiKey || !from || !to) {
    return { status: 'pending', error: 'support_email_not_configured' }
  }

  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: context.requesterEmail ?? undefined,
        subject: `[TALIA Support] ${bounded(context.tenantName, 80)} · ${bounded(context.sourceName, 80)}`,
        text: buildText(context),
      }),
    })

    if (!response.ok) {
      return { status: 'failed', error: `support_email_provider_${response.status}` }
    }

    const payload = await response.json().catch(() => null) as { id?: unknown } | null
    return { status: 'sent', providerId: typeof payload?.id === 'string' ? payload.id : null }
  } catch {
    return { status: 'failed', error: 'support_email_delivery_failed' }
  }
}

function buildText(context: KnowledgeSourceSupportContext) {
  return [
    'A customer requested help with a managed web knowledge source.',
    '',
    `Request: ${context.requestId}`,
    `Tenant: ${context.tenantName} (${context.tenantId})`,
    `Source: ${context.sourceName} (${context.sourceId})`,
    `URL: ${context.sourceUrl ?? 'not available'}`,
    `Sync run: ${context.runId ?? 'not available'}`,
    `Error code: ${context.errorCode ?? 'not available'}`,
    `Requester: ${context.requesterEmail ?? 'not available'}`,
    '',
    'Customer message:',
    bounded(context.customerMessage.trim(), 2000),
  ].join('\n')
}

function bounded(value: string, maxLength: number) {
  return value.slice(0, maxLength)
}
