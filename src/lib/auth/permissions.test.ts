import { describe, expect, it } from 'vitest'
import { normalizeTenantModuleKey, normalizeTenantModules } from './permissions'

describe('normalizeTenantModuleKey', () => {
  it('maps the legacy chatbot module to the canonical web module', () => {
    expect(normalizeTenantModuleKey('chatbot')).toBe('web')
  })

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
  it('exposes legacy Web entitlements through the canonical key', () => {
    expect(normalizeTenantModules([
      { module_key: 'chatbot', status: 'active' },
      { module_key: 'data', status: 'active' },
    ])).toEqual({ web: 'active', data: 'active' })
  })

  it('prefers a canonical Web row when both keys exist', () => {
    expect(normalizeTenantModules([
      { module_key: 'web', status: 'disabled' },
      { module_key: 'chatbot', status: 'active' },
    ])).toEqual({ web: 'disabled' })
  })
})
