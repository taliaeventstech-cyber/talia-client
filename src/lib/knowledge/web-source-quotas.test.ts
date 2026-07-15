import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MANAGED_WEB_QUOTA_LIMITS,
  isManagedWebQuotaError,
  resolveManagedWebQuotaLimits
} from './web-source-quotas'

describe('managed web quota limits', () => {
  it('uses the same universal defaults when no entitlement override exists', () => {
    expect(resolveManagedWebQuotaLimits(null)).toEqual(DEFAULT_MANAGED_WEB_QUOTA_LIMITS)
  })

  it('accepts bounded entitlement overrides for a future plan policy', () => {
    expect(resolveManagedWebQuotaLimits({
      managed_web_sources: 20,
      managed_web_documents: 1_000,
      managed_web_pages_per_source: 250,
      managed_web_manual_syncs_per_day: 25,
    })).toEqual({
      maxSources: 20,
      maxDocuments: 1_000,
      maxPagesPerSource: 250,
      maxManualSyncsPerDay: 25,
    })
  })

  it('falls back or clamps malformed and unsafe values', () => {
    expect(resolveManagedWebQuotaLimits({
      managed_web_sources: 'many',
      managed_web_documents: 50_000,
      managed_web_pages_per_source: 0,
      managed_web_manual_syncs_per_day: 2.5,
    })).toEqual({
      maxSources: DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxSources,
      maxDocuments: 10_000,
      maxPagesPerSource: 1,
      maxManualSyncsPerDay: DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxManualSyncsPerDay,
    })
  })

  it('recognizes authoritative database quota errors', () => {
    expect(isManagedWebQuotaError({ message: 'managed_web_manual_sync_quota_exceeded' }))
      .toBe('managed_web_manual_sync_quota_exceeded')
    expect(isManagedWebQuotaError({ message: 'duplicate key' })).toBeNull()
  })
})
