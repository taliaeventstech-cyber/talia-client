import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  hasTenantPermission,
  isTenantModuleEnabled,
  type TenantModuleKey,
  type TenantPermission,
  type TenantRole,
} from './permissions'

export type TenantAccess = {
  userId: string
  role: TenantRole
  modules: Partial<Record<TenantModuleKey, string>>
  source: 'tenant' | 'platform'
  platformRole?: string
}

export async function getTenantAccess(tenantId: string): Promise<TenantAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: membership }, { data: profile }, { data: modules }, { data: platformAdmin }] = await Promise.all([
    admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .eq('theatre_id', tenantId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
    admin
      .from('tenant_modules')
      .select('module_key, status')
      .eq('theatre_id', tenantId),
    admin
      .from('platform_admins')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const { data: venueMembership } = profile
    ? await admin
      .from('venue_memberships')
      .select('role')
      .eq('profile_id', profile.id)
      .eq('theatre_id', tenantId)
      .is('revoked_at', null)
      .maybeSingle()
    : { data: null }

  if (!membership && !venueMembership && !platformAdmin) redirect('/login')

  const role = membership?.role ?? venueMembership?.role ?? 'owner'

  return {
    userId: user.id,
    role,
    modules: Object.fromEntries((modules ?? []).map((module) => [module.module_key, module.status])),
    source: membership || venueMembership ? 'tenant' : 'platform',
    platformRole: platformAdmin?.role,
  } as TenantAccess
}

export async function requireTenantPermission(
  tenantId: string,
  permission: TenantPermission,
  moduleKey?: TenantModuleKey,
) {
  const access = await getTenantAccess(tenantId)

  if (!hasTenantPermission(access.role, permission)) {
    redirect(`/${tenantId}/overview`)
  }

  if (moduleKey && !isTenantModuleEnabled(access.modules[moduleKey])) {
    redirect(`/${tenantId}/overview`)
  }

  return access
}
