import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type TenantSettingsInput = {
  systemPrompt?: string | null
  fallbackEmail?: string
  fallbackPhone?: string
  widgetConfig: Json
}

export async function updateTenantSettings(admin: AdminClient, tenantId: string, input: TenantSettingsInput) {
  const updateData: {
    fallback_email: string | null
    fallback_phone: string | null
    widget_config: Json
    system_prompt?: string | null
  } = {
    fallback_email: input.fallbackEmail || null,
    fallback_phone: input.fallbackPhone || null,
    widget_config: input.widgetConfig,
  }

  if (input.systemPrompt !== undefined) {
    updateData.system_prompt = input.systemPrompt || null
  }

  const { error } = await admin
    .from('theatres')
    .update(updateData)
    .eq('id', tenantId)

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    }
  }

  return { ok: true as const }
}
