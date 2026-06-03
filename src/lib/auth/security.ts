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

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || request.headers.get('x-real-ip') || 'unknown'
}

export function checkRateLimit(request: NextRequest, rules: RateLimitRule[]) {
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
      return NextResponse.json(
        { error: 'too_many_attempts' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((current.resetAt - now) / 1000)),
          },
        }
      )
    }
  }

  return null
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}
