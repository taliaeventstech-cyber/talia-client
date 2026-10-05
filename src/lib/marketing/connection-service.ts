import type { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  metaMarketingConnectionSummarySchema,
  type MetaMarketingConnectionSummary,
} from '@/types/marketing'
import { buildMetaMarketingCredentialMetadata } from './credentials'

type AdminClient = ReturnType<typeof createAdminClient>

export async function getMetaMarketingConnectionSummary(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string },
): Promise<MetaMarketingConnectionSummary | null> {
  const { data, error } = await admin.rpc('get_meta_marketing_connection_summary', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
  })

  if (error) throw new Error('meta_marketing_connection_summary_failed')
  if (data === null) return null

  const parsed = metaMarketingConnectionSummarySchema.safeParse(data)
  if (!parsed.success) throw new Error('meta_marketing_connection_summary_invalid')
  return parsed.data
}

export async function saveMetaMarketingConnection(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    metaUserId: string
    business: { id: string; name: string }
    adAccount: { id: string; name: string; currency?: string }
    scopes: string[]
    credentials: {
      accessToken: string
      tokenType?: string
      expiresAt: string
    }
  },
) {
  const { data, error } = await admin.rpc('save_meta_marketing_connection', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_meta_user_id: input.metaUserId,
    p_business_id: input.business.id,
    p_business_name: input.business.name,
    p_ad_account_id: input.adAccount.id,
    p_ad_account_name: input.adAccount.name,
    p_ad_account_currency: input.adAccount.currency ?? null,
    p_scopes: input.scopes,
    p_credential_metadata: buildMetaMarketingCredentialMetadata(input.credentials),
  })

  const connectionId = z.uuid().safeParse(data)
  if (error || !connectionId.success) {
    throw new Error('meta_marketing_connection_save_failed')
  }
  return connectionId.data
}
