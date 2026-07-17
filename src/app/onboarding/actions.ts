'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createTenantForUser } from '@/lib/tenants/provisioning'
import { getUserVenueAccess } from '@/lib/auth/user-venues'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { optionalInternationalPhoneSchema } from '@/lib/phone/schema'

export type OnboardingFormState = {
  ok: boolean
  message: string
}

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  userRole: z.string().trim().min(1, 'El rol es obligatorio').max(120),
  heardAbout: z.string().trim().min(1, 'Indica cómo nos conociste').max(120),
  deployTimeline: z.string().trim().min(1, 'Indica cuándo quieres activar TALIA').max(120),
  entityType: z.enum(['theatre', 'museum', 'cinema', 'auditorium', 'festival', 'cultural_center', 'other']),
  theatreName: z.string().trim().min(2, 'El nombre de la entidad es obligatorio').max(120),
  websiteUrl: z.string().trim().url('La web debe ser una URL válida').optional().or(z.literal('')),
  primaryLanguage: z.enum(['ca', 'es', 'en']),
  fallbackEmail: z.string().trim().email('El email de contacto no es válido').optional().or(z.literal('')),
  fallbackPhone: optionalInternationalPhoneSchema,
  onboardingGoals: z.array(z.enum(['faqs', 'agenda', 'tickets', 'hours', 'location', 'accessibility', 'prices'])).min(1).max(3),
})

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export async function createTenant(
  _previousState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [existing] = await getUserVenueAccess(admin, user.id)

  if (existing) redirect(`/${existing.id}/overview`)

  const parsed = onboardingSchema.safeParse({
    fullName: formData.get('full_name'),
    userRole: formData.get('user_role'),
    heardAbout: formData.get('heard_about'),
    deployTimeline: formData.get('deploy_timeline'),
    entityType: formData.get('entity_type'),
    theatreName: formData.get('theatre_name'),
    websiteUrl: normalizeUrl(String(formData.get('website_url') ?? '')),
    primaryLanguage: formData.get('primary_language') || 'es',
    fallbackEmail: String(formData.get('fallback_email') ?? '').trim(),
    fallbackPhone: String(formData.get('fallback_phone') ?? '').trim(),
    onboardingGoals: formData.getAll('onboarding_goals'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Los datos no son válidos.' }
  }

  const created = await createTenantForUser(admin, {
    userId: user.id,
    userEmail: user.email ?? '',
    fullName: parsed.data.fullName,
    profileMetadata: {
      onboarding_role: parsed.data.userRole,
      heard_about: parsed.data.heardAbout,
      deploy_timeline: parsed.data.deployTimeline,
    },
    entityType: parsed.data.entityType,
    theatreName: parsed.data.theatreName,
    websiteUrl: parsed.data.websiteUrl || undefined,
    primaryLanguage: parsed.data.primaryLanguage,
    fallbackEmail: parsed.data.fallbackEmail || undefined,
    fallbackPhone: parsed.data.fallbackPhone || undefined,
    onboardingGoals: parsed.data.onboardingGoals,
  })

  if (!created.ok) {
    return { ok: false, message: `No se pudo crear el teatro: ${created.error}` }
  }

  redirect(`/${created.tenantId}/chatbot/setup`)
}
