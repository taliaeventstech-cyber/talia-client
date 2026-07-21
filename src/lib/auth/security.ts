import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const WINDOW_MS = 5 * 60 * 1000
const MAX_BUCKETS = 2_000

type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitRule = {
  key: string
  limit: number
  windowMs?: number
}

export type RateLimitResult = {
  retryAfterSeconds: number
  unavailable?: boolean
}

const buckets = new Map<string, RateLimitBucket>()

export const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres.')
  .max(128, 'La contraseña no puede superar 128 caracteres.')
  .refine((value) => /[a-z]/.test(value), 'La contraseña debe incluir una minúscula.')
  .refine((value) => /[A-Z]/.test(value), 'La contraseña debe incluir una mayúscula.')
  .refine((value) => /\d/.test(value), 'La contraseña debe incluir un número.')

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function getInternalRedirect(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

export function getClientIp(request: NextRequest | Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || request.headers.get('x-real-ip') || 'unknown'
}

export async function checkRateLimit(_request: NextRequest | Request, rules: RateLimitRule[]) {
  const result = await consumeRateLimit(rules)
  if (!result) return null

  return NextResponse.json(
    { error: result.unavailable ? 'rate_limit_unavailable' : 'too_many_attempts' },
    {
      status: result.unavailable ? 503 : 429,
      headers: result.unavailable ? undefined : {
        'Retry-After': String(result.retryAfterSeconds),
      },
    },
  )
}

export async function consumeRateLimit(rules: RateLimitRule[]): Promise<RateLimitResult | null> {
  if (process.env.NODE_ENV !== 'production') return consumeLocalRateLimit(rules)

  const hashSecret = process.env.RATE_LIMIT_HASH_SECRET ?? process.env.INTERNAL_API_KEY
  if (!hashSecret || hashSecret.length < 32) {
    console.error('[security-rate-limit] Missing a server-side hash secret')
    return { retryAfterSeconds: 1, unavailable: true }
  }

  const admin = createAdminClient()

  for (const rule of rules) {
    const windowSeconds = Math.max(1, Math.ceil((rule.windowMs ?? WINDOW_MS) / 1000))
    const separatorIndex = rule.key.indexOf(':')
    const scope = separatorIndex === -1 ? rule.key : rule.key.slice(0, separatorIndex)
    const keyHash = crypto
      .createHmac('sha256', hashSecret)
      .update(rule.key)
      .digest('hex')
    const { data, error } = await admin.rpc('consume_security_rate_limit', {
      p_scope: scope,
      p_key_hash: keyHash,
      p_limit: rule.limit,
      p_window_seconds: windowSeconds,
    })

    if (error || !data?.[0]) {
      console.error('[security-rate-limit] Distributed counter unavailable', {
        scope,
        code: error?.code,
      })
      return { retryAfterSeconds: 1, unavailable: true }
    }

    if (!data[0].allowed) {
      return { retryAfterSeconds: Math.max(1, data[0].retry_after_seconds) }
    }
  }

  return null
}

function consumeLocalRateLimit(rules: RateLimitRule[]): RateLimitResult | null {
  const now = Date.now()

  if (buckets.size > MAX_BUCKETS) pruneExpiredBuckets(now)

  for (const rule of rules) {
    const windowMs = rule.windowMs ?? WINDOW_MS
    const bucketKey = `${rule.key}:${Math.floor(now / windowMs)}`
    const current = buckets.get(bucketKey)

    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs })
      continue
    }

    current.count += 1

    if (current.count > rule.limit) {
      return {
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      }
    }
  }

  return null
}

export function clearRateLimitBucketsForTest() {
  buckets.clear()
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}
