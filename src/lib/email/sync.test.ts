// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { getEmailSyncConfig, getEmailSyncFailureState } from './sync'

describe('getEmailSyncConfig', () => {
  it('uses safer defaults for automated Gmail syncs', () => {
    expect(getEmailSyncConfig({})).toMatchObject({
      limit: 100,
      query: 'in:inbox newer_than:14d',
      autoProcessAfterSync: false,
      autoClassifyAfterSync: false,
      autoDraftAfterSync: false,
    })
  })

  it('keeps legacy auto process metadata as classify and draft automation', () => {
    expect(getEmailSyncConfig({ auto_process_after_sync: true })).toMatchObject({
      autoClassifyAfterSync: true,
      autoDraftAfterSync: true,
    })
  })

  it('allows classification and draft automation to be configured separately', () => {
    expect(getEmailSyncConfig({
      auto_classify_after_sync: true,
      auto_draft_after_sync: false,
    })).toMatchObject({
      autoClassifyAfterSync: true,
      autoDraftAfterSync: false,
    })
  })

  it('accepts larger backfill limits from Backstage metadata', () => {
    expect(getEmailSyncConfig({ gmail_sync_limit: 500 }).limit).toBe(500)
    expect(getEmailSyncConfig({ gmail_sync_limit: 999 }).limit).toBe(100)
  })
})

describe('getEmailSyncFailureState', () => {
  it('retries twice and leaves the connection in error after the third failure', () => {
    expect(getEmailSyncFailureState({})).toEqual({
      consecutiveFailures: 1,
      retryable: true,
      status: 'connected',
    })
    expect(getEmailSyncFailureState({ email_sync_consecutive_failures: 1 })).toEqual({
      consecutiveFailures: 2,
      retryable: true,
      status: 'connected',
    })
    expect(getEmailSyncFailureState({ email_sync_consecutive_failures: 2 })).toEqual({
      consecutiveFailures: 3,
      retryable: false,
      status: 'error',
    })
  })
})
