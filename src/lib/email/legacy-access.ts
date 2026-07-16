import {
  requireTenantPermission,
  requireTenantProductAccess,
} from '@/lib/auth/tenant-access'
import { redirect } from 'next/navigation'

const DEFAULT_LEGACY_EMAIL_AGENT_ACCOUNT = 'talia.events.tech@gmail.com'

export function isLegacyEmailAgentAccount(email: string | null | undefined) {
  if (!email) return false

  const allowedEmails = (process.env.LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS ?? DEFAULT_LEGACY_EMAIL_AGENT_ACCOUNT)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return allowedEmails.includes(email.trim().toLowerCase())
}

export async function requireLegacyEmailAgentProductAccess(tenantId: string) {
  const access = await requireTenantProductAccess(tenantId, 'manage_email', 'email')
  assertLegacyEmailAgentAccount(access.userEmail, tenantId)
  return access
}

export async function requireLegacyEmailAgentPermission(tenantId: string) {
  const access = await requireTenantPermission(tenantId, 'manage_email', 'email')
  assertLegacyEmailAgentAccount(access.userEmail, tenantId)
  return access
}

function assertLegacyEmailAgentAccount(email: string | null, tenantId: string): asserts email is string {
  if (!isLegacyEmailAgentAccount(email)) redirect(`/${tenantId}/overview`)
}
