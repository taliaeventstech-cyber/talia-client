// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { getEmailSyncConfig } from './sync'

describe('getEmailSyncConfig', () => {
  it('uses safer defaults for automated Gmail syncs', () => {
    expect(getEmailSyncConfig({})).toMatchObject({
      limit: 100,
      query: 'in:inbox newer_than:14d',
      autoProcessAfterSync: false,
    })
  })

  it('accepts larger backfill limits from Backstage metadata', () => {
    expect(getEmailSyncConfig({ gmail_sync_limit: 500 }).limit).toBe(500)
    expect(getEmailSyncConfig({ gmail_sync_limit: 999 }).limit).toBe(100)
  })
})
