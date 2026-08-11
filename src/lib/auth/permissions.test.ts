import { describe, expect, it } from 'vitest'
import { normalizeTenantModuleKey, normalizeTenantModules } from './permissions'

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
