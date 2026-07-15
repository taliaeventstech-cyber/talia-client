import type { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>
type OperationalAlertRow = Database['public']['Functions']['get_knowledge_web_operational_alerts']['Returns'][number]

export type KnowledgeWebAlertSeverity = 'critical' | 'warning'
export type KnowledgeWebAlertKind =
  | 'source_failure_streak'
  | 'source_sync_overdue'
  | 'source_quota_usage'
  | 'source_page_quota_usage'
  | 'document_quota_usage'
  | 'manual_sync_quota_usage'

export type KnowledgeWebOperationalAlert = {
  id: string
  tenantId: string
  tenantName: string
  sourceId: string | null
  sourceName: string | null
  kind: KnowledgeWebAlertKind
  severity: KnowledgeWebAlertSeverity
  title: string
  detail: string
  currentValue: number
  limitValue: number
  ratio: number
  occurredAt: string
}

export type KnowledgeWebOperationalAlertsResult = {
  alerts: KnowledgeWebOperationalAlert[]
  error: string | null
}

export async function getKnowledgeWebOperationalAlerts(
  admin: AdminClient,
  options: { tenantId?: string; limit?: number; now?: Date } = {}
): Promise<KnowledgeWebOperationalAlertsResult> {
  const { data, error } = await admin.rpc('get_knowledge_web_operational_alerts', {
    p_limit: options.limit ?? 100,
    p_now: (options.now ?? new Date()).toISOString(),
    p_theatre_id: options.tenantId,
    p_warning_ratio: 0.8,
  })

  if (error) {
    console.error('knowledge_web_operational_alerts_failed', {
      tenantId: options.tenantId ?? null,
      code: error.code,
      message: error.message,
    })
    return { alerts: [], error: 'No se han podido cargar las alertas operativas.' }
  }

  return {
    alerts: (data ?? []).map(buildKnowledgeWebOperationalAlert),
    error: null,
  }
}

export function buildKnowledgeWebOperationalAlert(row: OperationalAlertRow): KnowledgeWebOperationalAlert {
  const kind = isAlertKind(row.kind) ? row.kind : 'source_failure_streak'
  const severity: KnowledgeWebAlertSeverity = row.severity === 'critical' ? 'critical' : 'warning'
  const sourceName = row.source_name?.trim() || null
  const ratio = Math.max(0, Number(row.ratio) || 0)
  const base = {
    id: row.alert_key,
    tenantId: row.theatre_id,
    tenantName: row.theatre_name,
    sourceId: row.source_id,
    sourceName,
    kind,
    severity,
    currentValue: row.current_value,
    limitValue: row.limit_value,
    ratio,
    occurredAt: row.occurred_at,
  }

  if (kind === 'source_failure_streak') {
    return {
      ...base,
      title: `${sourceName ?? 'Fuente web'} acumula incidencias`,
      detail: `${row.current_value} sincronizaciones consecutivas con incidencias${formatRunError(row.latest_status, row.error_code)}.`,
    }
  }

  if (kind === 'source_sync_overdue') {
    return {
      ...base,
      title: `${sourceName ?? 'Fuente web'} está pendiente de actualización`,
      detail: `La sincronización programada lleva ${formatHours(row.current_value)} vencida.`,
    }
  }

  const quota = getQuotaCopy(kind)
  return {
    ...base,
    title: quota.title,
    detail: `Uso: ${row.current_value} de ${row.limit_value} ${quota.unit} (${Math.round(ratio * 100)}%).`,
  }
}

function isAlertKind(value: string): value is KnowledgeWebAlertKind {
  return [
    'source_failure_streak',
    'source_sync_overdue',
    'source_quota_usage',
    'source_page_quota_usage',
    'document_quota_usage',
    'manual_sync_quota_usage',
  ].includes(value)
}

function formatRunError(status: string | null, errorCode: string | null) {
  const parts = [status, errorCode].filter(Boolean)
  return parts.length ? ` (${parts.join(' · ')})` : ''
}

function formatHours(hours: number) {
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days} d ${remainingHours} h` : `${days} d`
}

function getQuotaCopy(kind: Exclude<KnowledgeWebAlertKind, 'source_failure_streak' | 'source_sync_overdue'>) {
  if (kind === 'source_quota_usage') return { title: 'Cuota de fuentes web cerca del límite', unit: 'fuentes' }
  if (kind === 'source_page_quota_usage') return { title: 'Cuota de páginas de la fuente cerca del límite', unit: 'páginas' }
  if (kind === 'document_quota_usage') return { title: 'Cuota de páginas cerca del límite', unit: 'páginas' }
  return { title: 'Cuota diaria de sincronizaciones manuales cerca del límite', unit: 'sincronizaciones' }
}
