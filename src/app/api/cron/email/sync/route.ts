import {
  listDueEmailSyncTenants,
  syncAndMaybeProcessEmail,
  type EmailAutomationResult,
} from '@/lib/email/automation'
import {
  claimEmailSyncRun,
  finishEmailSyncRun,
  getEmailSyncRunStatus,
  summarizeEmailSyncResults,
} from '@/lib/email/scheduler'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const workerId = crypto.randomUUID()
  const startedAt = Date.now()
  const claim = await claimEmailSyncRun(admin, workerId)

  if (!claim.ok) {
    console.error(JSON.stringify({
      event: 'email_sync_claim_failed',
      duration_ms: Date.now() - startedAt,
      error: claim.error,
    }))
    return NextResponse.json({ error: 'Could not claim email sync run' }, { status: 500 })
  }

  if (!claim.runId) {
    console.info(JSON.stringify({
      event: 'email_sync_skipped',
      reason: 'run_already_active',
      duration_ms: Date.now() - startedAt,
    }))
    return NextResponse.json({ ok: true, skipped: 'run_already_active' }, { status: 202 })
  }

  const limit = getLimit(request)
  console.info(JSON.stringify({ event: 'email_sync_started', run_id: claim.runId, limit }))

  try {
    const dueTenants = await listDueEmailSyncTenants(admin, { limit })
    if (!dueTenants.ok) {
      const finish = await finishEmailSyncRun(admin, {
        runId: claim.runId,
        workerId,
        status: 'failed',
        summary: emptySummary(),
        errorCode: 'list_due_connections_failed',
        errorMessage: dueTenants.error,
      })
      console.error(JSON.stringify({
        event: 'email_sync_failed',
        run_id: claim.runId,
        duration_ms: Date.now() - startedAt,
        error_code: 'list_due_connections_failed',
        run_recorded: finish.ok,
      }))
      return NextResponse.json({ error: 'Could not list due email connections', runId: claim.runId }, { status: 500 })
    }

    const results: EmailAutomationResult[] = []
    for (const tenantId of dueTenants.tenantIds) {
      results.push(await syncAndMaybeProcessEmail(admin, tenantId))
    }

    const summary = summarizeEmailSyncResults(results)
    const status = getEmailSyncRunStatus(summary)
    const finish = await finishEmailSyncRun(admin, {
      runId: claim.runId,
      workerId,
      status,
      summary,
      errorCode: status === 'failed' ? 'all_connections_failed' : undefined,
      errorMessage: status === 'failed' ? 'All due email connections failed to sync.' : undefined,
    })

    console.info(JSON.stringify({
      event: 'email_sync_completed',
      run_id: claim.runId,
      status,
      duration_ms: Date.now() - startedAt,
      run_recorded: finish.ok,
      ...summary,
    }))

    if (!finish.ok) {
      console.error(JSON.stringify({
        event: 'email_sync_finish_failed',
        run_id: claim.runId,
        error: finish.error,
      }))
      return NextResponse.json({ error: 'Could not finish email sync run', runId: claim.runId }, { status: 500 })
    }

    return NextResponse.json({
      ok: status !== 'failed',
      runId: claim.runId,
      status,
      durationMs: Date.now() - startedAt,
      ...summary,
    }, { status: status === 'failed' ? 500 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const finish = await finishEmailSyncRun(admin, {
      runId: claim.runId,
      workerId,
      status: 'failed',
      summary: emptySummary(),
      errorCode: 'unexpected_scheduler_error',
      errorMessage: message,
    })
    console.error(JSON.stringify({
      event: 'email_sync_failed',
      run_id: claim.runId,
      duration_ms: Date.now() - startedAt,
      error_code: 'unexpected_scheduler_error',
      run_recorded: finish.ok,
    }))
    return NextResponse.json({ error: 'Unexpected email sync scheduler error', runId: claim.runId }, { status: 500 })
  }
}

export function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true
  return process.env.NODE_ENV !== 'production' && !cronSecret
}

function getLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get('limit') ?? 25)
  if (!Number.isInteger(value)) return 25
  return Math.min(Math.max(value, 1), 50)
}

function emptySummary() {
  return {
    checked: 0,
    synced: 0,
    failed: 0,
    imported: 0,
    skipped: 0,
    inspected: 0,
    processed: 0,
  }
}
