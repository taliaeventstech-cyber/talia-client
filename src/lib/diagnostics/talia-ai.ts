import {
  diagnosticReportSchema,
  diagnosticUsageSchema,
  type DiagnosticAnalysis,
  type DiagnosticArtifactType,
} from './report'

const DIAGNOSTIC_REQUEST_TIMEOUT_MS = 100_000

type AnalyzeDiagnosticInput = {
  tenantId: string
  artifactType: DiagnosticArtifactType
  artifactId: string
  artifact: Record<string, unknown>
}

export async function analyzeDiagnosticWithTaliaAi(
  input: AnalyzeDiagnosticInput,
): Promise<{ ok: true; analysis: DiagnosticAnalysis } | { ok: false; error: string }> {
  const baseUrl = process.env.TALIA_AI_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.TALIA_AI_INTERNAL_API_KEY

  if (!baseUrl || !apiKey) {
    return { ok: false, error: 'TALIA AI no está configurado en este entorno.' }
  }

  try {
    const response = await fetch(`${baseUrl}/v1/diagnostics/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: input.tenantId,
        artifact_type: input.artifactType,
        artifact_id: input.artifactId,
        artifact: input.artifact,
      }),
      cache: 'no-store',
      // talia-ai may use three 30-second provider attempts plus bounded backoff.
      signal: AbortSignal.timeout(DIAGNOSTIC_REQUEST_TIMEOUT_MS),
    })
    const body = await readJson(response)

    if (!response.ok) {
      return { ok: false, error: getSafeServiceError(body, response.status) }
    }

    const report = diagnosticReportSchema.safeParse(getRecord(body)?.report)
    const provider = getRecord(body)?.provider
    const model = getRecord(body)?.model
    const usage = diagnosticUsageSchema.safeParse(getRecord(body)?.usage)
    if (!report.success || typeof provider !== 'string' || typeof model !== 'string' || !usage.success) {
      return { ok: false, error: 'TALIA AI devolvió un diagnóstico con un formato no válido.' }
    }

    return {
      ok: true,
      analysis: { report: report.data, provider, model, usage: usage.data },
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return {
      ok: false,
      error: timedOut
        ? 'El análisis ha superado el tiempo máximo. Inténtalo de nuevo.'
        : 'No se pudo conectar con TALIA AI para generar el diagnóstico.',
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function getSafeServiceError(value: unknown, status: number) {
  const body = getRecord(value)
  const code = typeof body?.error === 'string' ? body.error : null
  if (status === 429) return 'Se ha alcanzado temporalmente el límite del servicio de diagnóstico.'
  if (code === 'model_unavailable') return 'El modelo de diagnóstico no está disponible temporalmente.'
  if (code === 'invalid_model_response') return 'La IA no pudo generar un informe estructurado. Inténtalo de nuevo.'
  return `TALIA AI no pudo completar el diagnóstico (${status}).`
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}
