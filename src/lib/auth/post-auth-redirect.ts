import type { createAdminClient } from '@/lib/supabase/admin'
import { getUserVenueAccess } from './user-venues'

type AdminClient = ReturnType<typeof createAdminClient>

export async function getPostAuthRedirectPath(admin: AdminClient, userId: string) {
  const [{ data: platformAdmin }, venues] = await Promise.all([
    admin
      .from('platform_admins')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle(),
    getUserVenueAccess(admin, userId),
  ])

  if (platformAdmin) return '/backstage'
  const accountIds = Array.from(new Set(venues.map((venue) => venue.accountId)))

  if (venues.length === 1) return `/${venues[0].id}/overview`
  if (accountIds.length === 1 && accountIds[0]) return `/accounts/${accountIds[0]}`
  if (venues.length > 1) return '/agora'

  return '/onboarding'
}
