'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import {
  createPausedMetaMarketingCampaign,
  MetaMarketingCampaignCreationError,
} from '@/lib/marketing/campaign-creation-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { metaMarketingCampaignObjectiveSchema } from '@/types/marketing'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const inputSchema = z.object({
  requestId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  objective: metaMarketingCampaignObjectiveSchema,
  noSpecialAdCategoryConfirmed: z.literal('on'),
})

export type MetaMarketingCampaignCreateActionState = {
  ok: true
  providerCampaignId: string
} | {
  ok: false
  code: 'invalid' | 'connection' | 'in_progress' | 'provider' | 'save'
} | null

export async function createMetaMarketingCampaignAction(
  tenantId: string,
  _previousState: MetaMarketingCampaignCreateActionState,
  formData: FormData,
): Promise<MetaMarketingCampaignCreateActionState> {
  void _previousState
  if (!z.uuid().safeParse(tenantId).success) return { ok: false, code: 'invalid' }

  const parsed = inputSchema.safeParse({
    requestId: formData.get('requestId'),
    name: formData.get('name'),
    objective: formData.get('objective'),
    noSpecialAdCategoryConfirmed: formData.get('noSpecialAdCategoryConfirmed'),
  })
  if (!parsed.success) return { ok: false, code: 'invalid' }

  const access = await requireTenantProductAccess(
    tenantId,
    'manage_marketing',
    'marketing',
  )

  try {
    const result = await createPausedMetaMarketingCampaign(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
      requestId: parsed.data.requestId,
      name: parsed.data.name,
      objective: parsed.data.objective,
    })
    revalidatePath(`/${tenantId}/marketing`)
    return { ok: true, providerCampaignId: result.providerCampaignId }
  } catch (error) {
    console.error('[meta-marketing-campaign-create] creation failed', {
      tenantId,
      code: error instanceof MetaMarketingCampaignCreationError
        ? error.code
        : 'meta_marketing_campaign_creation_failed',
    })
    return {
      ok: false,
      code: error instanceof MetaMarketingCampaignCreationError ? error.kind : 'save',
    }
  }
}
