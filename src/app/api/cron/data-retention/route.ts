import { NextRequest, NextResponse } from 'next/server'

type RetentionResult = {
  category: string
  cutoff: string
  affected_rows: number
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false'

  try {
    const results = await applyDataRetention(dryRun)

    return NextResponse.json({
      ok: true,
      dryRun,
      affectedRows: results.reduce((total, result) => total + Number(result.affected_rows ?? 0), 0),
      results,
    })
  } catch (error) {
    console.error('[data-retention-cron]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'data_retention_failed' },
      { status: 500 },
    )
  }
}

async function applyDataRetention(dryRun: boolean) {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_data_retention`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_dry_run: dryRun }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Supabase retention RPC failed: ${await response.text()}`)
  }

  return response.json() as Promise<RetentionResult[]>
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

function requiredEnv(key: string) {
  const value = process.env[key]
  if (!value) throw new Error(`Missing ${key}`)
  return value
}
