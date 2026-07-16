import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { normalizePlatformPermissions } from './permissions'

export async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('role, permissions')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!platformAdmin) redirect('/login')

  return {
    user,
    role: platformAdmin.role,
    permissions: normalizePlatformPermissions(platformAdmin.permissions),
  }
}
