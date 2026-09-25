import { createHash } from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export function hashEmailProviderMessageId(connectionId: string, providerMessageId: string) {
  return createHash('sha256')
    .update(`${connectionId}:${providerMessageId}`)
    .digest('hex')
}

export async function deleteEmailThreadsFromTalia(
  admin: AdminClient,
  input: { tenantId: string; threadIds: string[] },
) {
  const { data, error } = await admin.rpc('delete_email_threads_from_talia', {
    p_theatre_id: input.tenantId,
    p_thread_ids: input.threadIds,
  })

  if (error) throw new Error('email_thread_delete_failed')

  return { deleted: typeof data === 'number' ? data : 0 }
}
