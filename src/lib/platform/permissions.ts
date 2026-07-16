import type { Json } from '@/types/database.types'

export const PLATFORM_PERMISSIONS = ['manage_customer_billing'] as const

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number]

export function normalizePlatformPermissions(value: Json | null | undefined): PlatformPermission[] {
  if (!Array.isArray(value)) return []
  return value.filter((permission): permission is PlatformPermission =>
    typeof permission === 'string' && PLATFORM_PERMISSIONS.includes(permission as PlatformPermission)
  )
}

export function hasPlatformPermission(
  permissions: readonly PlatformPermission[],
  permission: PlatformPermission,
) {
  return permissions.includes(permission)
}
