'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  completeWhatsappEmbeddedSignup,
  embeddedSignupCompletionSchema,
} from '@/lib/whatsapp/connection-service'
import { MetaEmbeddedSignupError } from '@/lib/whatsapp/embedded-signup'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type WhatsappEmbeddedSignupActionResult =
  | { ok: true }
  | { ok: false; code: 'invalid' | 'provider_error' | 'unavailable' }

const tenantSchema = z.uuid()

export async function completeWhatsappEmbeddedSignupAction(
  tenantId: string,
  rawInput: unknown,
): Promise<WhatsappEmbeddedSignupActionResult> {
  if (!tenantSchema.safeParse(tenantId).success) return { ok: false, code: 'invalid' }
  const input = embeddedSignupCompletionSchema.safeParse(rawInput)
  if (!input.success) return { ok: false, code: 'invalid' }

  const access = await requireTenantProductAccess(tenantId, 'manage_whatsapp', 'whatsapp')
  try {
    await completeWhatsappEmbeddedSignup(createAdminClient(), {
      tenantId,
      actorUserId: access.userId,
      ...input.data,
    })
    revalidatePath(`/${tenantId}/whatsapp`)
    revalidatePath(`/${tenantId}/whatsapp/settings`)
    return { ok: true }
  } catch (error) {
    if (error instanceof MetaEmbeddedSignupError) {
      console.error('[whatsapp-embedded-signup] Meta rejected connection', {
        tenantId,
        code: error.code,
        status: error.status,
      })
      return { ok: false, code: 'provider_error' }
    }
    console.error('[whatsapp-embedded-signup] connection failed', { tenantId })
    return { ok: false, code: 'unavailable' }
  }
}
