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
  if (venues.length === 1) return `/${venues[0].id}/overview`
  if (venues.length > 1) return '/agora'

  return '/onboarding'
}
