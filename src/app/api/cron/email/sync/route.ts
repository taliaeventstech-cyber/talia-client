import {
  listDueEmailSyncTenants,
  syncAndMaybeProcessEmail,
  type EmailAutomationResult,
} from '@/lib/email/automation'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const limit = getLimit(request)
  const dueTenants = await listDueEmailSyncTenants(admin, { limit })

  if (!dueTenants.ok) {
    return NextResponse.json({ error: dueTenants.error }, { status: 500 })
  }

  const results: EmailAutomationResult[] = []

  for (const tenantId of dueTenants.tenantIds) {
    results.push(await syncAndMaybeProcessEmail(admin, tenantId))
  }

  return NextResponse.json({
    ok: true,
    checked: dueTenants.tenantIds.length,
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    imported: results.reduce((sum, result) => sum + (result.ok ? result.imported : 0), 0),
    skipped: results.reduce((sum, result) => sum + (result.ok ? result.skipped : 0), 0),
    inspected: results.reduce((sum, result) => sum + (result.ok ? result.inspected : 0), 0),
    processed: results.reduce((sum, result) => sum + (result.ok ? result.processed : 0), 0),
    results,
  })
}

function isAuthorizedCronRequest(request: NextRequest) {
  const internalKey = process.env.INTERNAL_API_KEY
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  const internalHeader = request.headers.get('x-talia-internal-key')

  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true
  if (internalKey && authorization === `Bearer ${internalKey}`) return true
  if (internalKey && internalHeader === internalKey) return true

  return process.env.NODE_ENV !== 'production' && !internalKey && !cronSecret
}

function getLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get('limit') ?? 25)
  if (!Number.isInteger(value)) return 25
  return Math.min(Math.max(value, 1), 50)
}
