import type { Database } from '@/types/database.types'
import { isAttentionChannel, type AttentionChannel } from '@/lib/attention/channel-agent'

export type TenantRole = Database['public']['Enums']['user_role']

export type TenantModuleKey =
  | AttentionChannel
  | 'data'
  | 'marketing'

export function normalizeTenantModuleKey(value: unknown): TenantModuleKey | null {
  if (isAttentionChannel(value)) return value
  return value === 'data' || value === 'marketing' ? value : null
}

export function normalizeTenantModules(modules: Array<{ module_key: string; status: string }>) {
  const normalized: Partial<Record<TenantModuleKey, string>> = {}

  for (const row of modules) {
    const key = normalizeTenantModuleKey(row.module_key)
    if (!key) continue
    normalized[key] = row.status
  }

  return normalized
}

export type TenantPermission =
  | 'view_overview'
  | 'view_conversations'
  | 'manage_conversations'
  | 'delete_conversations'
  | 'view_analytics'
  | 'manage_chatbot'
  | 'manage_knowledge'
  | 'manage_voice'
  | 'manage_email'
  | 'manage_whatsapp'
  | 'manage_users'

const permissionRoles: Record<TenantPermission, TenantRole[]> = {
  view_overview: ['owner', 'admin', 'operator', 'analyst', 'viewer'],
  view_conversations: ['owner', 'admin', 'operator', 'viewer'],
  manage_conversations: ['owner', 'admin', 'operator'],
  delete_conversations: ['owner', 'admin'],
  view_analytics: ['owner', 'admin', 'analyst', 'viewer'],
  manage_chatbot: ['owner', 'admin'],
  manage_knowledge: ['owner', 'admin'],
  manage_voice: ['owner', 'admin'],
  manage_email: ['owner', 'admin'],
  manage_whatsapp: ['owner', 'admin'],
  manage_users: ['owner'],
}

export function hasTenantPermission(role: TenantRole, permission: TenantPermission) {
  return permissionRoles[permission].includes(role)
}

export function isTenantModuleEnabled(status: string | null | undefined) {
  return status === 'active' || status === 'trial'
}
