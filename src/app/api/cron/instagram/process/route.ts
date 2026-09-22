import { getBearerToken, matchesServerSecret } from '@/lib/auth/server-secret'
import { authorizeInternalApiRequest } from '@/lib/auth/internal-api'
import { processInstagramInboundJobs } from '@/lib/instagram/processor'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!matchesServerSecret(getBearerToken(request.headers.get('authorization')), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runProcessor(request)
}

export async function POST(request: NextRequest) {
  const authorization = authorizeInternalApiRequest(request.headers.get('x-internal-api-key'))
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }
  return runProcessor(request)
}

async function runProcessor(request: NextRequest) {
  const startedAt = Date.now()
  try {
    const summary = await processInstagramInboundJobs(undefined, {
      limit: parseLimit(request.nextUrl.searchParams.get('limit')),
    })
    console.info(JSON.stringify({
      event: 'instagram_processor_completed',
      duration_ms: Date.now() - startedAt,
      ...summary,
    }))
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...summary })
  } catch {
    console.error(JSON.stringify({
      event: 'instagram_processor_failed',
      duration_ms: Date.now() - startedAt,
      error_code: 'processor_failed',
    }))
    return NextResponse.json({ error: 'instagram_processor_failed' }, { status: 500 })
  }
}

function parseLimit(value: string | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, 3)) : 3
}
