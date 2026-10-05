import { describe, expect, it } from 'vitest'
import { hasTenantPermission, normalizeTenantModuleKey, normalizeTenantModules } from './permissions'

describe('normalizeTenantModuleKey', () => {
  it('preserves canonical module keys', () => {
    expect(normalizeTenantModuleKey('web')).toBe('web')
    expect(normalizeTenantModuleKey('email')).toBe('email')
    expect(normalizeTenantModuleKey('data')).toBe('data')
  })

  it('rejects unknown module keys', () => {
    expect(normalizeTenantModuleKey('unknown')).toBeNull()
  })
})

describe('normalizeTenantModules', () => {
  it('exposes canonical Web entitlements', () => {
    expect(normalizeTenantModules([
      { module_key: 'web', status: 'active' },
      { module_key: 'data', status: 'active' },
    ])).toEqual({ web: 'active', data: 'active' })
  })

  it('ignores unknown module rows', () => {
    expect(normalizeTenantModules([
      { module_key: 'web', status: 'disabled' },
      { module_key: 'unknown', status: 'active' },
    ])).toEqual({ web: 'disabled' })
  })
})

describe('Marketing permissions', () => {
  it('limits management to venue owners and admins', () => {
    expect(hasTenantPermission('owner', 'manage_marketing')).toBe(true)
    expect(hasTenantPermission('admin', 'manage_marketing')).toBe(true)
    expect(hasTenantPermission('operator', 'manage_marketing')).toBe(false)
    expect(hasTenantPermission('viewer', 'manage_marketing')).toBe(false)
  })
})
