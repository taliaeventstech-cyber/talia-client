'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type SettingsFormState = {
  ok: boolean
  message: string
}

const settingsSchema = z.object({
  plan: z.enum(['esencial', 'profesional', 'pro']),
  assistantName: z.string().trim().min(1, 'El nombre del asistente es obligatorio').max(60),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe estar en formato hexadecimal'),
  fallbackEmail: z.string().trim().email('El email no es válido').optional().or(z.literal('')),
  fallbackPhone: z.string().trim().max(40).optional(),
  systemPrompt: z.string().trim().max(8000).optional(),
  scrapeUrls: z.array(z.string().trim().url('Todas las URLs deben ser válidas')).max(4),
})

export async function updateTenantSettings(
  tenantId: string,
  _previousState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .eq('theatre_id', tenantId)
    .single()

  if (!membership || membership.role !== 'admin') {
    return { ok: false, message: 'No tienes permisos para editar esta configuración.' }
  }

  const urls = ['scrape_url_1', 'scrape_url_2', 'scrape_url_3', 'scrape_url_4']
    .map((key) => String(formData.get(key) ?? '').trim())
    .filter(Boolean)

  const parsed = settingsSchema.safeParse({
    plan: formData.get('plan'),
    assistantName: formData.get('assistant_name'),
    primaryColor: formData.get('primary_color'),
    fallbackEmail: String(formData.get('fallback_email') ?? '').trim(),
    fallbackPhone: String(formData.get('fallback_phone') ?? '').trim(),
    systemPrompt: String(formData.get('system_prompt') ?? '').trim(),
    scrapeUrls: urls,
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La configuración no es válida.' }
  }

  const { data } = parsed
  const { error } = await admin
    .from('theatres')
    .update({
      plan: data.plan,
      system_prompt: data.systemPrompt || null,
      fallback_email: data.fallbackEmail || null,
      fallback_phone: data.fallbackPhone || null,
      scrape_urls: data.scrapeUrls,
      widget_config: {
        assistantName: data.assistantName,
        primaryColor: data.primaryColor,
      },
    })
    .eq('id', tenantId)

  if (error) {
    return { ok: false, message: `No se pudo guardar: ${error.message}` }
  }

  revalidatePath(`/${tenantId}/settings`)
  return { ok: true, message: 'Configuración guardada correctamente.' }
}
