type TaliaAiEmbedResponse = {
  ok?: unknown
  checked?: unknown
  embedded?: unknown
  failed?: unknown
  skipped?: unknown
  error?: unknown
  details?: unknown
}

export type TaliaAiEmbedResult = {
  ok: boolean
  checked: number
  embedded: number
  failed: number
  skipped: number
  error?: string
}

export async function embedKnowledgeSourceWithTaliaAi({
  tenantId,
  sourceId,
  limit,
  retryErrors = false,
}: {
  tenantId: string
  sourceId: string
  limit: number
  retryErrors?: boolean
}): Promise<TaliaAiEmbedResult | null> {
  const baseUrl = process.env.TALIA_AI_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.TALIA_AI_INTERNAL_API_KEY

  if (!baseUrl || !apiKey) return null

  try {
    const response = await fetch(`${baseUrl}/v1/knowledge/embed`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        source_id: sourceId,
        limit,
        retry_errors: retryErrors,
      }),
    })

    const text = await response.text()
    const body = parseResponse(text)
    if (!response.ok || body?.ok === false) {
      return {
        ok: false,
        checked: numberOrZero(body?.checked),
        embedded: numberOrZero(body?.embedded),
        failed: numberOrZero(body?.failed),
        skipped: numberOrZero(body?.skipped),
        error: getErrorMessage(body) ?? `talia-ai responded with ${response.status}`,
      }
    }

    return {
      ok: true,
      checked: numberOrZero(body?.checked),
      embedded: numberOrZero(body?.embedded),
      failed: numberOrZero(body?.failed),
      skipped: numberOrZero(body?.skipped),
    }
  } catch (error) {
    return {
      ok: false,
      checked: 0,
      embedded: 0,
      failed: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function parseResponse(text: string): TaliaAiEmbedResponse | null {
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function getErrorMessage(body: TaliaAiEmbedResponse | null) {
  if (typeof body?.error === 'string') return body.error
  if (typeof body?.details === 'string') return body.details
  return null
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
