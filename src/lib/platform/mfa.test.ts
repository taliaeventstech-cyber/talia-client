import { describe, expect, it } from 'vitest'
import {
  getPlatformMfaRedirect,
  getVerifiedTotpFactor,
  isPlatformMfaSatisfied,
  normalizePlatformMfaNextPath,
} from './mfa'

describe('platform MFA', () => {
  it('requires AAL2', () => {
    expect(isPlatformMfaSatisfied('aal2')).toBe(true)
    expect(isPlatformMfaSatisfied('aal1')).toBe(false)
    expect(isPlatformMfaSatisfied(null)).toBe(false)
  })

  it('selects only a verified TOTP factor', () => {
    const factor = getVerifiedTotpFactor([
      { id: 'unverified', factor_type: 'totp', status: 'unverified' },
      { id: 'phone', factor_type: 'phone', status: 'verified' },
      { id: 'verified', factor_type: 'totp', status: 'verified' },
    ])

    expect(factor?.id).toBe('verified')
  })

  it('rejects external and recursive return paths', () => {
    expect(normalizePlatformMfaNextPath('https://example.com')).toBe('/backstage')
    expect(normalizePlatformMfaNextPath('//example.com')).toBe('/backstage')
    expect(normalizePlatformMfaNextPath('/backstage-mfa?next=/backstage')).toBe('/backstage')
    expect(normalizePlatformMfaNextPath('/backstage/tenants')).toBe('/backstage/tenants')
  })

  it('encodes the protected return path', () => {
    expect(getPlatformMfaRedirect('/backstage/tenants')).toBe(
      '/backstage-mfa?next=%2Fbackstage%2Ftenants',
    )
  })
})
