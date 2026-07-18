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

export async function hasEmailAgentPreviewAccess(_tenantId: string, email: string | null | undefined) {
  return isLegacyEmailAgentAccount(email)
}

export async function requireEmailAgentPreviewProductAccess(tenantId: string) {
  const access = await requireTenantProductAccess(tenantId, 'manage_email', 'email')
  await assertEmailAgentPreviewAccess(access.userEmail, tenantId)
  return access
}

export async function requireEmailAgentPreviewPermission(tenantId: string) {
  const access = await requireTenantPermission(tenantId, 'manage_email', 'email')
  await assertEmailAgentPreviewAccess(access.userEmail, tenantId)
  return access
}

async function assertEmailAgentPreviewAccess(email: string | null, tenantId: string) {
  if (!await hasEmailAgentPreviewAccess(tenantId, email)) redirect(`/${tenantId}/overview`)
}
