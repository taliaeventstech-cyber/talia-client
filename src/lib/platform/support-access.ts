import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

type PlatformSupportTarget = {
  userId: string
  accountId: string
  theatreId?: string | null
  targetType: 'account' | 'theatre'
  targetId: string
}

const AUDIT_WINDOW_MS = 60 * 60 * 1000

export async function recordPlatformSupportAccess(admin: AdminClient, target: PlatformSupportTarget) {
  const since = new Date(Date.now() - AUDIT_WINDOW_MS).toISOString()
  let existingQuery = admin
    .from('audit_events')
    .select('id')
    .eq('actor_user_id', target.userId)
    .eq('action', 'platform.support_accessed')
    .eq('target_type', target.targetType)
    .eq('target_id', target.targetId)
    .gte('created_at', since)

  existingQuery = target.theatreId
    ? existingQuery.eq('theatre_id', target.theatreId)
    : existingQuery.is('theatre_id', null)

  const { data: existing } = await existingQuery.limit(1).maybeSingle()
  if (existing) return

  const { error } = await admin.from('audit_events').insert({
    account_id: target.accountId,
    theatre_id: target.theatreId ?? null,
    actor_user_id: target.userId,
    action: 'platform.support_accessed',
    target_type: target.targetType,
    target_id: target.targetId,
    metadata: { authorization_source: 'platform_admins' },
  })

  if (error) console.error('Failed to audit platform support access', error)
}
