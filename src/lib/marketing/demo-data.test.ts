import { describe, expect, it } from 'vitest'
import {
  metaMarketingConnectionSummarySchema,
  metaMarketingDashboardSnapshotSchema,
} from '@/types/marketing'
import { getMarketingDemoData } from './demo-data'

describe('getMarketingDemoData', () => {
  it('returns a realistic schema-valid dashboard only in non-production environments', () => {
    const demo = getMarketingDemoData('1', 'development')

    expect(demo).not.toBeNull()
    expect(metaMarketingConnectionSummarySchema.safeParse(demo?.connection).success).toBe(true)
    expect(metaMarketingDashboardSnapshotSchema.safeParse(demo?.snapshot).success).toBe(true)
    expect(demo?.snapshot.daily_insights.length).toBeGreaterThan(1)
    expect(demo?.snapshot.campaigns.length).toBeGreaterThan(1)
    expect(demo?.snapshot.summary?.spend).toBeGreaterThan(0)
  })

  it('cannot expose demo data in production', () => {
    expect(getMarketingDemoData('1', 'production')).toBeNull()
    expect(getMarketingDemoData(undefined, 'development')).toBeNull()
  })
})
