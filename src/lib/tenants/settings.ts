import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type TenantSettingsInput = {
  plan: 'esencial' | 'profesional' | 'pro'
  systemPrompt?: string
  fallbackEmail?: string
  fallbackPhone?: string
  scrapeUrls: string[]
  widgetConfig: Json
}

export async function updateTenantSettings(admin: AdminClient, tenantId: string, input: TenantSettingsInput) {
  const { error } = await admin
    .from('theatres')
    .update({
      plan: input.plan,
      system_prompt: input.systemPrompt || null,
      fallback_email: input.fallbackEmail || null,
      fallback_phone: input.fallbackPhone || null,
      scrape_urls: input.scrapeUrls,
      widget_config: input.widgetConfig,
    })
    .eq('id', tenantId)

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    }
  }

  return { ok: true as const }
}
