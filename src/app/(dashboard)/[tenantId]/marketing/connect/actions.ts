'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { saveMetaMarketingConnection } from '@/lib/marketing/connection-service'
import { fetchMetaMarketingBusinesses, MetaMarketingOAuthError } from '@/lib/marketing/oauth'
import {
  META_MARKETING_OAUTH_COOKIE,
  parsePendingMetaMarketingOAuthSession,
} from '@/lib/marketing/oauth-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const selectionSchema = z.object({
  businessId: z.string().trim().min(1).max(200),
  adAccountId: z.string().trim().min(1).max(200),
})

export type MetaMarketingSelectionActionState = {
  ok: false
  code: 'invalid' | 'session' | 'asset' | 'provider' | 'save'
} | null

export async function completeMetaMarketingConnectionAction(
  tenantId: string,
  _previousState: MetaMarketingSelectionActionState,
  formData: FormData,
): Promise<MetaMarketingSelectionActionState> {
  if (!z.uuid().safeParse(tenantId).success) return { ok: false, code: 'invalid' }
  const selection = selectionSchema.safeParse({
    businessId: formData.get('businessId'),
    adAccountId: formData.get('adAccountId'),
  })
  if (!selection.success) return { ok: false, code: 'invalid' }

  const access = await requireTenantProductAccess(
    tenantId,
    'manage_marketing',
    'marketing',
  )
  const cookieStore = await cookies()
  const pendingCookie = cookieStore.get(META_MARKETING_OAUTH_COOKIE)?.value
  if (!pendingCookie) return { ok: false, code: 'session' }

  let session: ReturnType<typeof parsePendingMetaMarketingOAuthSession>
  try {
    session = parsePendingMetaMarketingOAuthSession(pendingCookie)
  } catch {
    return { ok: false, code: 'session' }
  }
  if (session.tenantId !== tenantId || session.userId !== access.userId) {
    return { ok: false, code: 'session' }
  }

  try {
    const businesses = await fetchMetaMarketingBusinesses(session.accessToken)
    const business = businesses.find((candidate) => candidate.id === selection.data.businessId)
    const adAccount = business?.adAccounts.find(
      (candidate) => candidate.id === selection.data.adAccountId,
    )
    if (!business || !adAccount) return { ok: false, code: 'asset' }

    await saveMetaMarketingConnection(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
      metaUserId: session.metaUserId,
      business: { id: business.id, name: business.name },
      adAccount: {
        id: adAccount.id,
        name: adAccount.name,
        currency: adAccount.currency,
      },
      scopes: session.scopes,
      credentials: {
        accessToken: session.accessToken,
        tokenType: session.tokenType,
        expiresAt: session.tokenExpiresAt,
      },
    })
  } catch (error) {
    console.error('[meta-marketing-oauth] asset selection failed', {
      tenantId,
      code: error instanceof MetaMarketingOAuthError
        ? error.code
        : error instanceof Error && /^meta_marketing_[a-z0-9_]+$/.test(error.message)
          ? error.message
          : 'meta_marketing_selection_failed',
    })
    return {
      ok: false,
      code: error instanceof MetaMarketingOAuthError ? 'provider' : 'save',
    }
  }

  cookieStore.delete(META_MARKETING_OAUTH_COOKIE)
  revalidatePath(`/${tenantId}/marketing`)
  redirect(`/${tenantId}/marketing?meta_connected=1`)
}
