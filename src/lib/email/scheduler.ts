import type { createAdminClient } from '@/lib/supabase/admin'
import type { EmailAutomationResult } from './automation'

type AdminClient = ReturnType<typeof createAdminClient>

export type EmailSyncRunSummary = {
  checked: number
  synced: number
  failed: number
  imported: number
  skipped: number
  inspected: number
  processed: number
}

export async function claimEmailSyncRun(admin: AdminClient, workerId: string) {
  const { data, error } = await admin.rpc('claim_email_sync_run', {
    p_worker_id: workerId,
    p_lease_seconds: 600,
  })

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, runId: data }
}

export async function finishEmailSyncRun(
  admin: AdminClient,
  input: {
    runId: string
    workerId: string
    status: 'succeeded' | 'partial' | 'failed'
    summary: EmailSyncRunSummary
    errorCode?: string
    errorMessage?: string
  },
) {
  const { data, error } = await admin.rpc('finish_email_sync_run', {
    p_run_id: input.runId,
    p_worker_id: input.workerId,
    p_status: input.status,
    p_checked_count: input.summary.checked,
    p_synced_count: input.summary.synced,
    p_failed_count: input.summary.failed,
    p_imported_count: input.summary.imported,
    p_skipped_count: input.summary.skipped,
    p_inspected_count: input.summary.inspected,
    p_processed_count: input.summary.processed,
    p_error_code: input.errorCode,
    p_error_message: input.errorMessage,
  })

  if (error) return { ok: false as const, error: error.message }
  if (data !== true) return { ok: false as const, error: 'Email sync run was not active when finishing' }
  return { ok: true as const }
}

export function summarizeEmailSyncResults(results: EmailAutomationResult[]): EmailSyncRunSummary {
  return {
    checked: results.length,
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    imported: results.reduce((sum, result) => sum + (result.ok ? result.imported : 0), 0),
    skipped: results.reduce((sum, result) => sum + (result.ok ? result.skipped : 0), 0),
    inspected: results.reduce((sum, result) => sum + (result.ok ? result.inspected : 0), 0),
    processed: results.reduce((sum, result) => sum + (result.ok ? result.processed : 0), 0),
  }
}

export function getEmailSyncRunStatus(summary: EmailSyncRunSummary) {
  if (summary.failed === 0) return 'succeeded' as const
  if (summary.synced === 0) return 'failed' as const
  return 'partial' as const
}
