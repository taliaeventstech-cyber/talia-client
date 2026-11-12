import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export const DEFAULT_MANAGED_WEB_QUOTA_LIMITS = {
  maxSources: 10,
  maxDocuments: 500,
  maxPagesPerSource: 100,
  maxManualSyncsPerDay: 10,
} as const

export type ManagedWebQuotaLimits = {
  maxSources: number
  maxDocuments: number
  maxPagesPerSource: number
  maxManualSyncsPerDay: number
}

export type ManagedWebQuotaUsage = {
  limits: ManagedWebQuotaLimits
  sources: number
  documents: number
  manualSyncsToday: number
}

export function resolveManagedWebQuotaLimits(value: Json | null | undefined): ManagedWebQuotaLimits {
  const limits = asRecord(value)
  return {
    maxSources: readInteger(limits.managed_web_sources, DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxSources, 1, 100),
    maxDocuments: readInteger(limits.managed_web_documents, DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxDocuments, 1, 10_000),
    maxPagesPerSource: readInteger(
      limits.managed_web_pages_per_source,
      DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxPagesPerSource,
      1,
      500
    ),
    maxManualSyncsPerDay: readInteger(
      limits.managed_web_manual_syncs_per_day,
      DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxManualSyncsPerDay,
      1,
      100
    ),
  }
}

export async function getManagedWebQuotaUsage(
  admin: AdminClient,
  tenantId: string,
  referenceDate = new Date()
): Promise<ManagedWebQuotaUsage> {
  const startOfUtcDay = new Date(referenceDate)
  startOfUtcDay.setUTCHours(0, 0, 0, 0)

  const [entitlement, sources, documents, manualSyncs] = await Promise.all([
    admin
      .from('tenant_module_entitlements')
      .select('limits')
      .eq('theatre_id', tenantId)
      .eq('module_key', 'data')
      .maybeSingle(),
    admin
      .from('knowledge_sources')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .in('type', ['url', 'sitemap', 'website']),
    // Only managed web documents count; installed-widget pages also live in
    // knowledge_documents but are governed by their own daily cap.
    admin
      .from('knowledge_documents')
      .select('id, knowledge_sources!inner(type)', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .in('knowledge_sources.type', ['url', 'sitemap', 'website'])
      .neq('status', 'removed'),
    admin
      .from('knowledge_sync_runs')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('trigger', 'manual')
      .gte('created_at', startOfUtcDay.toISOString()),
  ])

  return {
    limits: resolveManagedWebQuotaLimits(entitlement.data?.limits),
    sources: sources.count ?? 0,
    documents: documents.count ?? 0,
    manualSyncsToday: manualSyncs.count ?? 0,
  }
}

export function isManagedWebQuotaError(error: { message?: string | null; details?: string | null } | null | undefined) {
  const value = `${error?.message ?? ''} ${error?.details ?? ''}`
  return value.match(/managed_web_(source|document|source_page|manual_sync)_quota_exceeded/)?.[0] ?? null
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}

function readInteger(value: Json | undefined, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback
  return Math.min(Math.max(value, minimum), maximum)
}
