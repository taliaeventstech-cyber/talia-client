export type { AccountRole } from '@/lib/auth/identity'

export function canManageAccountBilling(input: {
  source: 'tenant' | 'platform'
  accountRole?: string | null
}) {
  return input.source === 'tenant' && input.accountRole === 'owner'
}
