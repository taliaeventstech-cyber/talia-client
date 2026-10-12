'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import {
  createPausedMetaMarketingTrafficAdSet,
  MetaMarketingAdSetCreationError,
} from '@/lib/marketing/ad-set-creation-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const inputSchema = z.object({
  requestId: z.uuid(),
  providerCampaignId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  dailyBudget: z.string().trim().regex(/^\d{1,10}(?:\.\d{1,4})?$/),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  countries: z.string().trim().min(2).max(100),
  ageMin: z.coerce.number().int().min(18).max(65),
  ageMax: z.coerce.number().int().min(18).max(65),
})

export type MetaMarketingAdSetCreateActionState = {
  ok: true
  providerAdSetId: string
} | {
  ok: false
  code: 'invalid' | 'connection' | 'in_progress' | 'provider' | 'save'
} | null

export async function createMetaMarketingAdSetAction(
  tenantId: string,
  _previousState: MetaMarketingAdSetCreateActionState,
  formData: FormData,
): Promise<MetaMarketingAdSetCreateActionState> {
  void _previousState
  if (!z.uuid().safeParse(tenantId).success) return { ok: false, code: 'invalid' }

  const parsed = inputSchema.safeParse({
    requestId: formData.get('requestId'),
    providerCampaignId: formData.get('providerCampaignId'),
    name: formData.get('name'),
    dailyBudget: formData.get('dailyBudget'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    countries: formData.get('countries'),
    ageMin: formData.get('ageMin'),
    ageMax: formData.get('ageMax'),
  })
  if (!parsed.success) return { ok: false, code: 'invalid' }

  const countries = parsed.data.countries
    .split(',')
    .map((country) => country.trim())
    .filter(Boolean)
  if (countries.length === 0 || countries.length > 25) {
    return { ok: false, code: 'invalid' }
  }

  const access = await requireTenantProductAccess(
    tenantId,
    'manage_marketing',
    'marketing',
  )

  try {
    const result = await createPausedMetaMarketingTrafficAdSet(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
      requestId: parsed.data.requestId,
      providerCampaignId: parsed.data.providerCampaignId,
      name: parsed.data.name,
      dailyBudget: parsed.data.dailyBudget,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      countries,
      ageMin: parsed.data.ageMin,
      ageMax: parsed.data.ageMax,
    })
    revalidatePath(`/${tenantId}/marketing`)
    return { ok: true, providerAdSetId: result.providerAdSetId }
  } catch (error) {
    console.error('[meta-marketing-ad-set-create] creation failed', {
      tenantId,
      code: error instanceof MetaMarketingAdSetCreationError
        ? error.code
        : 'meta_marketing_ad_set_creation_failed',
    })
    return {
      ok: false,
      code: error instanceof MetaMarketingAdSetCreationError ? error.kind : 'save',
    }
  }
}
