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
  entityType: z.enum(['theatre', 'museum', 'cinema', 'auditorium', 'festival', 'cultural_center', 'other']),
  theatreName: z.string().trim().min(2, 'El nombre de la entidad es obligatorio').max(120),
  websiteUrl: z.string().trim().url('La web debe ser una URL válida').optional().or(z.literal('')),
  primaryLanguage: z.enum(['ca', 'es', 'en']),
  fallbackEmail: z.string().trim().email('El email de contacto no es válido').optional().or(z.literal('')),
  fallbackPhone: z.string().trim().max(40).optional(),
  onboardingGoals: z.array(z.enum(['faqs', 'agenda', 'tickets', 'hours', 'location', 'accessibility', 'prices'])).max(7),
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
    entityType: formData.get('entity_type'),
    theatreName: formData.get('theatre_name'),
    websiteUrl: String(formData.get('website_url') ?? '').trim(),
    primaryLanguage: formData.get('primary_language') || 'es',
    fallbackEmail: String(formData.get('fallback_email') ?? '').trim(),
    fallbackPhone: String(formData.get('fallback_phone') ?? '').trim(),
    onboardingGoals: formData.getAll('onboarding_goals'),
    primaryColor: formData.get('primary_color'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Los datos no son válidos.' }
  }

  const admin = createAdminClient()
  const created = await createTenantForUser(admin, {
    userId: user.id,
    userEmail: user.email ?? '',
    entityType: parsed.data.entityType,
    theatreName: parsed.data.theatreName,
    websiteUrl: parsed.data.websiteUrl || undefined,
    primaryLanguage: parsed.data.primaryLanguage,
    fallbackEmail: parsed.data.fallbackEmail || undefined,
    fallbackPhone: parsed.data.fallbackPhone || undefined,
    onboardingGoals: parsed.data.onboardingGoals,
    primaryColor: parsed.data.primaryColor,
  })

  if (!created.ok) {
    return { ok: false, message: `No se pudo crear el teatro: ${created.error}` }
  }

  redirect(`/${created.tenantId}/overview`)
}
