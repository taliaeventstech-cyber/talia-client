import type { ClearViewRequest } from './clear-view'

const DEFAULT_WINDOW_MS = 10 * 60 * 1000
const DEFAULT_LIMIT = 20
const MAX_BUCKETS = 2_000
const MAX_CLEAR_VIEW_INPUT_CHARS = 12_000

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

export function getClearViewClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || request.headers.get('x-real-ip') || 'unknown'
}

export function getClearViewInputLength(input: ClearViewRequest) {
  const values = [
    input.url,
    input.page.title,
    ...input.page.summary,
    ...input.page.actions.flatMap((action) => [action.label, action.href]),
    ...input.page.sections.flatMap((section) => [section.title, ...section.items]),
  ]

  return values.reduce((total, value) => total + value.length, 0)
}

export function isClearViewInputTooLarge(input: ClearViewRequest) {
  return getClearViewInputLength(input) > MAX_CLEAR_VIEW_INPUT_CHARS
}

export function checkClearViewRateLimit(input: {
  tenantId: string
  clientIp: string
  now?: number
  limit?: number
  windowMs?: number
}) {
  const now = input.now ?? Date.now()
  const limit = input.limit ?? DEFAULT_LIMIT
  const windowMs = input.windowMs ?? DEFAULT_WINDOW_MS
  const scopedWindow = Math.floor(now / windowMs)
  const key = `${input.tenantId}:${input.clientIp}:${scopedWindow}`

  if (buckets.size > MAX_BUCKETS) pruneExpiredBuckets(now)

  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  current.count += 1

  if (current.count <= limit) return null

  return {
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  }
}

export function clearClearViewRateLimitBucketsForTest() {
  buckets.clear()
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}
