import { describe, expect, it } from 'vitest'
import { hasPlatformPermission, normalizePlatformPermissions } from './permissions'

describe('platform permissions', () => {
  it('accepts only known explicit capabilities', () => {
    expect(normalizePlatformPermissions(['manage_customer_billing', 'unknown'])).toEqual(['manage_customer_billing'])
    expect(normalizePlatformPermissions({})).toEqual([])
  })

  it('does not infer billing authority from the admin role', () => {
    expect(hasPlatformPermission([], 'manage_customer_billing')).toBe(false)
    expect(hasPlatformPermission(['manage_customer_billing'], 'manage_customer_billing')).toBe(true)
  })
})
