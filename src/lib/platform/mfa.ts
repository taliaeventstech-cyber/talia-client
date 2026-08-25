export const PLATFORM_MFA_PATH = '/backstage-mfa'

export type PlatformMfaFactor = {
  id: string
  factor_type: string
  status: string
}

export function isPlatformMfaSatisfied(level: string | null | undefined) {
  return level === 'aal2'
}

export function getVerifiedTotpFactor(factors: PlatformMfaFactor[]) {
  return factors.find(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  ) ?? null
}

export function getPlatformMfaRedirect(nextPath = '/backstage') {
  return `${PLATFORM_MFA_PATH}?next=${encodeURIComponent(normalizePlatformMfaNextPath(nextPath))}`
}

export function normalizePlatformMfaNextPath(value?: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/backstage'
  if (value.startsWith(PLATFORM_MFA_PATH)) return '/backstage'
  return value
}
