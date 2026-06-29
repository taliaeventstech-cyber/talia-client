import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getBillingAccess, type BillingAccess } from '@/lib/billing/access'
import { isChatbotSetupCompleted } from '@/lib/chatbot/setup-status'
import type { Json } from '@/types/database.types'
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
  accountStatus?: string
  accountCreatedAt?: string | null
  accountMetadata?: Json | null
  billingAccess: BillingAccess
  chatbotSetupCompleted: boolean
  platformRole?: string
}

export async function getTenantAccess(tenantId: string): Promise<TenantAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: membership }, { data: profile }, { data: modules }, { data: platformAdmin }, { data: tenantAccount }] = await Promise.all([
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
    admin
      .from('theatres')
      .select('system_prompt, widget_config, accounts(status, created_at, metadata)')
      .eq('id', tenantId)
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

  const source = membership || venueMembership ? 'tenant' : 'platform'
  const accountStatus = getAccountStatus(tenantAccount)
  const accountCreatedAt = getAccountCreatedAt(tenantAccount)
  const accountMetadata = getAccountMetadata(tenantAccount)

  return {
    userId: user.id,
    role,
    modules: Object.fromEntries((modules ?? []).map((module) => [module.module_key, module.status])),
    source,
    accountStatus,
    accountCreatedAt,
    accountMetadata,
    billingAccess: getBillingAccess({
      source,
      accountStatus,
      accountCreatedAt,
      accountMetadata,
    }),
    chatbotSetupCompleted: isChatbotSetupCompleted({
      widgetConfig: tenantAccount?.widget_config,
    }),
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

export async function requireTenantProductAccess(
  tenantId: string,
  permission: TenantPermission,
  moduleKey?: TenantModuleKey,
) {
  const access = await requireTenantPermission(tenantId, permission, moduleKey)

  if (!access.billingAccess.hasProductAccess) {
    redirect(`/${tenantId}/upgrade`)
  }

  return access
}

function getAccountStatus(value: unknown) {
  const account = getAccount(value)
  const status = account?.status
  return typeof status === 'string' ? status : undefined
}

function getAccountCreatedAt(value: unknown) {
  const account = getAccount(value)
  const createdAt = account?.created_at
  return typeof createdAt === 'string' ? createdAt : null
}

function getAccountMetadata(value: unknown): Json | null {
  const account = getAccount(value)
  return (account?.metadata as Json | null | undefined) ?? null
}

function getAccount(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const account = (value as { accounts?: unknown }).accounts
  if (Array.isArray(account)) return account[0] as Record<string, unknown> | undefined ?? null
  if (!account || typeof account !== 'object') return null
  return account as Record<string, unknown>
}
