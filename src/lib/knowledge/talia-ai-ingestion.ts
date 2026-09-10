type TaliaAiIngestResponse = {
  ok?: unknown
  source_id?: unknown
  chunks?: unknown
  error?: unknown
  details?: unknown
  programme?: unknown
}

export type TaliaAiProgrammeResult = {
  status: 'ready' | 'skipped' | 'error' | 'unavailable'
  eventCount: number
}

export type TaliaAiIngestResult = {
  ok: boolean
  sourceId: string
  chunks: number
  error?: string
  programme?: TaliaAiProgrammeResult
}

export async function ingestKnowledgeTextWithTaliaAi({
  tenantId,
  sourceId,
  sourceType,
  text,
  url,
  storage,
  metadata,
}: {
  tenantId: string
  sourceId: string
  sourceType: string
  text?: string
  url?: string
  storage?: {
    bucket: string
    path: string
  }
  metadata: Record<string, unknown>
}): Promise<TaliaAiIngestResult | null> {
  const baseUrl = process.env.TALIA_AI_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.TALIA_AI_INTERNAL_API_KEY

  if (!baseUrl || !apiKey) return null

  try {
    const response = await fetch(`${baseUrl}/v1/knowledge/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        source_id: sourceId,
        source_type: sourceType,
        ...(text ? { text } : {}),
        ...(url ? { url } : {}),
        ...(storage ? { storage } : {}),
        metadata,
      }),
    })

    const body = parseResponse(await response.text())
    if (!response.ok || body?.ok === false) {
      return {
        ok: false,
        sourceId,
        chunks: 0,
        error: getErrorMessage(body) ?? `talia-ai responded with ${response.status}`,
      }
    }

    const programme = parseProgrammeResult(body?.programme)
    return {
      ok: true,
      sourceId: typeof body?.source_id === 'string' ? body.source_id : sourceId,
      chunks: numberOrZero(body?.chunks),
      ...(programme ? { programme } : {}),
    }
  } catch (error) {
    return {
      ok: false,
      sourceId,
      chunks: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function parseProgrammeResult(value: unknown): TaliaAiProgrammeResult | null {
  if (!isRecord(value)) return null
  const status = value.status
  if (
    status !== 'ready'
    && status !== 'skipped'
    && status !== 'error'
    && status !== 'unavailable'
  ) return null

  return {
    status,
    eventCount: numberOrZero(value.event_count),
  }
}

function parseResponse(text: string): TaliaAiIngestResponse | null {
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function getErrorMessage(body: TaliaAiIngestResponse | null) {
  if (typeof body?.details === 'string') return body.details
  if (typeof body?.error === 'string') return body.error
  return null
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
