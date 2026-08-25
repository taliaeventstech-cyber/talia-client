import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { normalizePlatformPermissions } from './permissions'
import {
  getPlatformMfaRedirect,
  isPlatformMfaSatisfied,
} from './mfa'

async function getPlatformAdminContext() {
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
    supabase,
    access: {
      user,
      role: platformAdmin.role,
      permissions: normalizePlatformPermissions(platformAdmin.permissions),
    },
  }
}

export async function requirePlatformAdminIdentity() {
  const { access } = await getPlatformAdminContext()
  return access
}

export async function requirePlatformMfa(nextPath = '/backstage') {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (error || !isPlatformMfaSatisfied(data.currentLevel)) {
    redirect(getPlatformMfaRedirect(nextPath))
  }
}

export async function requirePlatformAdmin() {
  const { supabase, access } = await getPlatformAdminContext()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (error || !isPlatformMfaSatisfied(data.currentLevel)) {
    redirect(getPlatformMfaRedirect())
  }

  return access
}
