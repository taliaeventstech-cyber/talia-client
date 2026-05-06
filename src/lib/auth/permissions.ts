import type { Database } from '@/types/database.types'

export type TenantRole = Database['public']['Enums']['user_role']

export type TenantModuleKey =
  | 'chatbot'
  | 'data'
  | 'voice'
  | 'email'
  | 'whatsapp'
  | 'instagram'
  | 'marketing'

export type TenantPermission =
  | 'view_overview'
  | 'view_conversations'
  | 'delete_conversations'
  | 'view_analytics'
  | 'manage_chatbot'
  | 'manage_knowledge'
  | 'manage_voice'
  | 'manage_users'

const permissionRoles: Record<TenantPermission, TenantRole[]> = {
  view_overview: ['owner', 'admin', 'operator', 'analyst', 'viewer'],
  view_conversations: ['owner', 'admin', 'operator', 'viewer'],
  delete_conversations: ['owner', 'admin'],
  view_analytics: ['owner', 'admin', 'analyst', 'viewer'],
  manage_chatbot: ['owner', 'admin'],
  manage_knowledge: ['owner', 'admin'],
  manage_voice: ['owner', 'admin'],
  manage_users: ['owner'],
}

export function hasTenantPermission(role: TenantRole, permission: TenantPermission) {
  return permissionRoles[permission].includes(role)
}

export function isTenantModuleEnabled(status: string | null | undefined) {
  return status === 'active' || status === 'trial'
}
