import type { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>
type ResponseTraceMetricsRow = Database['public']['Functions']['get_backstage_response_trace_metrics']['Returns'][number]

export type BackstageResponseTraceMetrics = {
  withSources: number
  withoutSources: number
  lowConfidence: number
  fallbacks: number
  responsePositive: number
  responseNegative: number
  sessionResolved: number
  sessionUnresolved: number
}

export async function getBackstageResponseTraceMetrics(
  admin: AdminClient,
  tenantId: string,
): Promise<BackstageResponseTraceMetrics> {
  const { data, error } = await admin.rpc('get_backstage_response_trace_metrics', {
    p_theatre_id: tenantId,
  })

  if (error) throw new Error(`No se pudieron cargar las métricas de trazabilidad: ${error.message}`)
  return normalizeBackstageResponseTraceMetrics(data?.[0])
}

export function normalizeBackstageResponseTraceMetrics(
  row: ResponseTraceMetricsRow | undefined,
): BackstageResponseTraceMetrics {
  return {
    withSources: normalizeCount(row?.with_sources),
    withoutSources: normalizeCount(row?.without_sources),
    lowConfidence: normalizeCount(row?.low_confidence),
    fallbacks: normalizeCount(row?.fallbacks),
    responsePositive: normalizeCount(row?.response_positive),
    responseNegative: normalizeCount(row?.response_negative),
    sessionResolved: normalizeCount(row?.session_resolved),
    sessionUnresolved: normalizeCount(row?.session_unresolved),
  }
}

function normalizeCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}
