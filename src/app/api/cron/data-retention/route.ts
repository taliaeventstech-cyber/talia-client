import { getBearerToken, matchesServerSecret } from '@/lib/auth/server-secret'
import { NextRequest, NextResponse } from 'next/server'

type RetentionResult = {
  category: string
  cutoff: string
  affected_rows: number
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedRetentionRequest(request)) {
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
  } catch {
    console.error(JSON.stringify({ event: 'data_retention_failed', error_code: 'retention_rpc_failed' }))
    return NextResponse.json(
      { error: 'data_retention_failed' },
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

export function isAuthorizedRetentionRequest(request: NextRequest) {
  const internalKey = process.env.INTERNAL_API_KEY
  const cronSecret = process.env.CRON_SECRET
  const bearerToken = getBearerToken(request.headers.get('authorization'))
  const internalHeader = request.headers.get('x-talia-internal-key')

  return matchesServerSecret(bearerToken, cronSecret)
    || matchesServerSecret(bearerToken, internalKey)
    || matchesServerSecret(internalHeader, internalKey)
}

function requiredEnv(key: string) {
  const value = process.env[key]
  if (!value) throw new Error(`Missing ${key}`)
  return value
}
