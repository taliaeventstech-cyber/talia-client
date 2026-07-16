import { describe, expect, it } from 'vitest'
import { canManageAccountBilling } from './permissions'

describe('account billing permissions', () => {
  it('allows account owners', () => {
    expect(canManageAccountBilling({ source: 'tenant', accountRole: 'owner' })).toBe(true)
  })

  it('does not grant billing changes from venue roles or platform support access', () => {
    expect(canManageAccountBilling({ source: 'platform', accountRole: null })).toBe(false)
    expect(canManageAccountBilling({ source: 'tenant', accountRole: 'admin' })).toBe(false)
    expect(canManageAccountBilling({ source: 'tenant', accountRole: 'billing' })).toBe(false)
    expect(canManageAccountBilling({ source: 'tenant', accountRole: 'viewer' })).toBe(false)
    expect(canManageAccountBilling({ source: 'tenant', accountRole: null })).toBe(false)
  })
})
