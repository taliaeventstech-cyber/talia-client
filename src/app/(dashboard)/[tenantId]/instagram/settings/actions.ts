'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { disconnectInstagramConnection } from '@/lib/instagram/connection-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type InstagramDisconnectActionResult =
  | { ok: true; providerWarning: boolean }
  | { ok: false; code: 'invalid' | 'unavailable' }

export async function disconnectInstagramConnectionAction(
  tenantId: string,
  connectionId: string,
): Promise<InstagramDisconnectActionResult> {
  if (!z.uuid().safeParse(tenantId).success || !z.uuid().safeParse(connectionId).success) {
    return { ok: false, code: 'invalid' }
  }

  const access = await requireTenantProductAccess(tenantId, 'manage_instagram', 'instagram')
  try {
    const result = await disconnectInstagramConnection(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
      connectionId,
    })
    revalidatePath(`/${tenantId}/instagram`)
    revalidatePath(`/${tenantId}/instagram/settings`)
    return { ok: true, providerWarning: result.providerWarning }
  } catch {
    console.error('[instagram-connection] disconnect failed', { tenantId, connectionId })
    return { ok: false, code: 'unavailable' }
  }
}
