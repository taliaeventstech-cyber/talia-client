import type { TenantRole } from './permissions'

export type GlobalRole = 'admin' | 'user'
export type AccountRole = 'owner' | 'admin' | 'billing' | 'viewer'

export function getGlobalRole(platformRole: string | null | undefined): GlobalRole {
  return platformRole ? 'admin' : 'user'
}

export function normalizeAccountRole(value: unknown): AccountRole | null {
  if (value === 'owner' || value === 'admin' || value === 'billing' || value === 'viewer') return value
  return null
}

export function resolveTenantRole(input: {
  platformRole?: string | null
  venueRole?: TenantRole | null
  accountRole?: AccountRole | null
}): TenantRole | null {
  if (input.platformRole) return 'owner'
  if (input.accountRole === 'owner') return 'owner'
  if (input.accountRole === 'admin') return 'admin'
  if (input.venueRole) return input.venueRole
  if (input.accountRole === 'billing' || input.accountRole === 'viewer') return 'viewer'
  return null
}
