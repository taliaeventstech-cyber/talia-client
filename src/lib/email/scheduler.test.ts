import { describe, expect, it } from 'vitest'
import { getEmailSyncRunStatus, summarizeEmailSyncResults } from './scheduler'

describe('email sync scheduler', () => {
  it('summarizes successful and failed tenant runs without exposing tenant data', () => {
    const summary = summarizeEmailSyncResults([
      { ok: true, tenantId: 'tenant-a', connectionId: 'connection-a', imported: 2, skipped: 3, inspected: 5, processed: 2 },
      { ok: false, tenantId: 'tenant-b', error: 'sync failed' },
    ])

    expect(summary).toEqual({
      checked: 2,
      synced: 1,
      failed: 1,
      imported: 2,
      skipped: 3,
      inspected: 5,
      processed: 2,
    })
    expect(getEmailSyncRunStatus(summary)).toBe('partial')
  })

  it('marks a run failed only when no tenant succeeded', () => {
    expect(getEmailSyncRunStatus({
      checked: 1,
      synced: 0,
      failed: 1,
      imported: 0,
      skipped: 0,
      inspected: 0,
      processed: 0,
    })).toBe('failed')
  })
})
