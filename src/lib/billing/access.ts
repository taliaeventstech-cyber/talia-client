import { FREE_TRIAL_DAYS } from '@/lib/billing/plans'
import type { Json } from '@/types/database.types'

export type BillingAccessInput = {
  source: 'tenant' | 'platform'
  accountStatus?: string
  accountCreatedAt?: string | null
  accountMetadata?: Json | null
  now?: Date
}

export type BillingAccess = {
  isPlatform: boolean
  isPaid: boolean
  isTrialing: boolean
  isTrialExpired: boolean
  hasProductAccess: boolean
  needsUpgrade: boolean
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialDaysRemaining: number | null
}

export function getBillingAccess(input: BillingAccessInput): BillingAccess {
  const now = input.now ?? new Date()
  const isPlatform = input.source === 'platform'
  const isPaid = input.accountStatus === 'active'
  const trialStartedAt = getMetadataDate(input.accountMetadata, 'trial_started_at') ?? input.accountCreatedAt ?? null
  const trialEndsAt = getMetadataDate(input.accountMetadata, 'trial_ends_at') ?? getFallbackTrialEndsAt(trialStartedAt)
  const trialEndsDate = trialEndsAt ? new Date(trialEndsAt) : null
  const isTrialing = input.accountStatus === 'trialing' && trialEndsDate !== null && trialEndsDate.getTime() > now.getTime()
  const isTrialExpired = input.accountStatus === 'trialing' && trialEndsDate !== null && trialEndsDate.getTime() <= now.getTime()
  const hasProductAccess = isPlatform || isPaid || isTrialing

  return {
    isPlatform,
    isPaid,
    isTrialing,
    isTrialExpired,
    hasProductAccess,
    needsUpgrade: !isPlatform && !hasProductAccess,
    trialStartedAt,
    trialEndsAt,
    trialDaysRemaining: trialEndsDate ? getDaysRemaining(now, trialEndsDate) : null,
  }
}

export function createTrialMetadata(now = new Date()) {
  const trialEndsAt = new Date(now)
  trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + FREE_TRIAL_DAYS)

  return {
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    trial_days: FREE_TRIAL_DAYS,
  }
}

function getMetadataDate(metadata: Json | null | undefined, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : null
}

function getFallbackTrialEndsAt(startedAt: string | null) {
  if (!startedAt) return null
  const date = new Date(startedAt)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + FREE_TRIAL_DAYS)
  return date.toISOString()
}

function getDaysRemaining(now: Date, endsAt: Date) {
  const diffMs = endsAt.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / 86_400_000))
}
