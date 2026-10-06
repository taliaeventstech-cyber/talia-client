'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { syncMetaMarketingSnapshot, MetaMarketingSyncError } from '@/lib/marketing/sync-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type MetaMarketingSyncActionState = {
  ok: true
} | {
  ok: false
  code: 'invalid' | 'connection' | 'reauthorize' | 'provider' | 'save'
} | null

export async function syncMetaMarketingAction(
  tenantId: string,
  _previousState: MetaMarketingSyncActionState,
): Promise<MetaMarketingSyncActionState> {
  void _previousState
  if (!z.uuid().safeParse(tenantId).success) return { ok: false, code: 'invalid' }

  const access = await requireTenantProductAccess(
    tenantId,
    'manage_marketing',
    'marketing',
  )

  try {
    await syncMetaMarketingSnapshot(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
    })
    revalidatePath(`/${tenantId}/marketing`)
    return { ok: true }
  } catch (error) {
    console.error('[meta-marketing-sync] sync failed', {
      tenantId,
      code: error instanceof MetaMarketingSyncError
        ? error.code
        : 'meta_marketing_sync_failed',
    })
    revalidatePath(`/${tenantId}/marketing`)
    return {
      ok: false,
      code: error instanceof MetaMarketingSyncError ? error.kind : 'save',
    }
  }
}
