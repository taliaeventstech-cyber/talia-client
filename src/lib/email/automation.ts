import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { processEmailMessage } from './service'
import { syncGmailMessages } from './sync'

type AdminClient = ReturnType<typeof createAdminClient>

export type EmailAutomationResult =
  | {
    ok: true
    tenantId: string
    imported: number
    skipped: number
    inspected: number
    processed: number
    connectionId: string
  }
  | {
    ok: false
    tenantId: string
    error: string
    details?: string
  }

export async function syncAndMaybeProcessEmail(admin: AdminClient, tenantId: string): Promise<EmailAutomationResult> {
  const result = await syncGmailMessages(admin, { tenantId })

  if (!result.ok) {
    return {
      ok: false,
      tenantId,
      error: result.error,
      details: 'details' in result ? result.details : undefined,
    }
  }

  let processed = 0
  if (result.autoProcessAfterSync && result.imported > 0) {
    for (let index = 0; index < result.imported; index += 1) {
      const processResult = await processEmailMessage(admin, { tenantId })
      if (!processResult.ok) break
      processed += 1
    }
  }

  return {
    ok: true,
    tenantId,
    imported: result.imported,
    skipped: result.skipped,
    inspected: result.inspected,
    processed,
    connectionId: result.connectionId,
  }
}

export async function listDueEmailSyncTenants(admin: AdminClient, input: { limit?: number } = {}) {
  const { data, error } = await admin
    .from('email_connections')
    .select('theatre_id, last_synced_at, metadata')
    .eq('provider', 'google')
    .eq('sync_mode', 'polling')
    .in('status', ['connected', 'syncing'])
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(input.limit ?? 25)

  if (error) {
    return { ok: false as const, error: error.message }
  }

  const now = Date.now()
  const tenantIds = (data ?? [])
    .filter((connection) => isDueForSync(connection.last_synced_at, connection.metadata, now))
    .map((connection) => connection.theatre_id)

  return { ok: true as const, tenantIds }
}

function isDueForSync(lastSyncedAt: string | null, metadata: Json, now: number) {
  if (!lastSyncedAt) return true

  const lastSyncTime = new Date(lastSyncedAt).getTime()
  if (Number.isNaN(lastSyncTime)) return true

  return now - lastSyncTime >= getSyncFrequencyMinutes(metadata) * 60 * 1000
}

function getSyncFrequencyMinutes(metadata: Json) {
  const record = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, Json | undefined>
    : {}
  const value = typeof record.sync_frequency_minutes === 'number'
    ? record.sync_frequency_minutes
    : 15

  return [15, 30, 60, 240].includes(value) ? value : 15
}
