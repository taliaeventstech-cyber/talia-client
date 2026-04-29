'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createTenantForUser } from '@/lib/tenants/provisioning'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type OnboardingFormState = {
  ok: boolean
  message: string
}

const onboardingSchema = z.object({
  theatreName: z.string().trim().min(2, 'El nombre del teatro es obligatorio').max(120),
  websiteUrl: z.string().trim().url('La web debe ser una URL válida').optional().or(z.literal('')),
  fallbackEmail: z.string().trim().email('El email de contacto no es válido').optional().or(z.literal('')),
  fallbackPhone: z.string().trim().max(40).optional(),
  assistantName: z.string().trim().min(1, 'El nombre del asistente es obligatorio').max(60),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe estar en formato hexadecimal'),
})

export async function createTenant(
  _previousState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('users')
    .select('theatre_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) redirect(`/${existing.theatre_id}/overview`)

  const parsed = onboardingSchema.safeParse({
    theatreName: formData.get('theatre_name'),
    websiteUrl: String(formData.get('website_url') ?? '').trim(),
    fallbackEmail: String(formData.get('fallback_email') ?? '').trim(),
    fallbackPhone: String(formData.get('fallback_phone') ?? '').trim(),
    assistantName: formData.get('assistant_name'),
    primaryColor: formData.get('primary_color'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Los datos no son válidos.' }
  }

  const admin = createAdminClient()
  const created = await createTenantForUser(admin, {
    userId: user.id,
    userEmail: user.email ?? '',
    theatreName: parsed.data.theatreName,
    websiteUrl: parsed.data.websiteUrl || undefined,
    fallbackEmail: parsed.data.fallbackEmail || undefined,
    fallbackPhone: parsed.data.fallbackPhone || undefined,
    assistantName: parsed.data.assistantName,
    primaryColor: parsed.data.primaryColor,
  })

  if (!created.ok) {
    return { ok: false, message: `No se pudo crear el teatro: ${created.error}` }
  }

  redirect(`/${created.tenantId}/overview`)
}
