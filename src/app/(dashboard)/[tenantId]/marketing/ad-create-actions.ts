'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import {
  createPausedMetaMarketingTrafficAd,
  MetaMarketingAdCreationError,
} from '@/lib/marketing/ad-creation-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { metaMarketingAdCallToActionSchema } from '@/types/marketing'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const inputSchema = z.object({
  requestId: z.uuid(),
  providerAdSetId: z.string().trim().regex(/^\d{1,30}$/),
  pageId: z.string().trim().regex(/^\d{1,30}$/),
  name: z.string().trim().min(1).max(200),
  primaryText: z.string().trim().min(1).max(500),
  headline: z.string().trim().min(1).max(200),
  destinationUrl: z.url().max(2048),
  imageUrl: z.url().max(2048),
  callToAction: metaMarketingAdCallToActionSchema,
})

export type MetaMarketingAdCreateActionState = {
  ok: true
  providerAdId: string
  providerCreativeId: string
} | {
  ok: false
  code: 'invalid' | 'connection' | 'in_progress' | 'provider' | 'save'
} | null

export async function createMetaMarketingAdAction(
  tenantId: string,
  _previousState: MetaMarketingAdCreateActionState,
  formData: FormData,
): Promise<MetaMarketingAdCreateActionState> {
  void _previousState
  if (!z.uuid().safeParse(tenantId).success) return { ok: false, code: 'invalid' }

  const parsed = inputSchema.safeParse({
    requestId: formData.get('requestId'),
    providerAdSetId: formData.get('providerAdSetId'),
    pageId: formData.get('pageId'),
    name: formData.get('name'),
    primaryText: formData.get('primaryText'),
    headline: formData.get('headline'),
    destinationUrl: formData.get('destinationUrl'),
    imageUrl: formData.get('imageUrl'),
    callToAction: formData.get('callToAction'),
  })
  if (!parsed.success) return { ok: false, code: 'invalid' }

  const access = await requireTenantProductAccess(
    tenantId,
    'manage_marketing',
    'marketing',
  )

  try {
    const result = await createPausedMetaMarketingTrafficAd(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
      ...parsed.data,
    })
    revalidatePath(`/${tenantId}/marketing`)
    return {
      ok: true,
      providerAdId: result.providerAdId,
      providerCreativeId: result.providerCreativeId,
    }
  } catch (error) {
    console.error('[meta-marketing-ad-create] creation failed', {
      tenantId,
      code: error instanceof MetaMarketingAdCreationError
        ? error.code
        : 'meta_marketing_ad_creation_failed',
    })
    return {
      ok: false,
      code: error instanceof MetaMarketingAdCreationError ? error.kind : 'save',
    }
  }
}
