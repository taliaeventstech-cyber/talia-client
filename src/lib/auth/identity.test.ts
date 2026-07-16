import { describe, expect, it } from 'vitest'
import { getGlobalRole, normalizeAccountRole, resolveTenantRole } from './identity'

describe('identity authorization model', () => {
  it('derives the only two global roles from platform administration', () => {
    expect(getGlobalRole('admin')).toBe('admin')
    expect(getGlobalRole(null)).toBe('user')
  })

  it('keeps account ownership separate from the global role', () => {
    expect(resolveTenantRole({ accountRole: 'owner' })).toBe('owner')
    expect(getGlobalRole(null)).toBe('user')
  })

  it('keeps account ownership authoritative across its venues', () => {
    expect(resolveTenantRole({ venueRole: 'viewer', accountRole: 'owner' })).toBe('owner')
    expect(resolveTenantRole({ venueRole: 'viewer', accountRole: 'admin' })).toBe('admin')
  })

  it('grants platform admins operational tenant access without a client membership', () => {
    expect(resolveTenantRole({ platformRole: 'admin' })).toBe('owner')
  })

  it('rejects unknown account roles', () => {
    expect(normalizeAccountRole('operator')).toBeNull()
    expect(resolveTenantRole({})).toBeNull()
  })
})
