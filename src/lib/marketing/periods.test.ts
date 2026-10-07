import { describe, expect, it } from 'vitest'
import {
  metaMarketingPeriodDays,
  metaMarketingPeriodSchema,
  parseMetaMarketingPeriod,
} from '@/types/marketing'

describe('Meta Marketing reporting periods', () => {
  it('accepts only the three bounded Meta presets', () => {
    expect(metaMarketingPeriodSchema.options).toEqual([
      'last_7d',
      'last_30d',
      'last_90d',
    ])
    expect(metaMarketingPeriodDays.last_90d).toBe(90)
  })

  it('falls back to last_30d for malformed URL input', () => {
    expect(parseMetaMarketingPeriod('last_7d')).toBe('last_7d')
    expect(parseMetaMarketingPeriod('lifetime')).toBe('last_30d')
    expect(parseMetaMarketingPeriod(['last_90d'])).toBe('last_30d')
  })
})
