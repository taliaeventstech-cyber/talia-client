'use server'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type CreateTenantState = {
  ok: boolean
  message: string
  tenantId?: string
}

export type UpdateTenantState = {
  ok: boolean
  message: string
}

const moduleKeys = ['chatbot', 'data', 'voice', 'email', 'whatsapp', 'instagram', 'marketing'] as const

const createTenantSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  entityType: z.enum(['theatre', 'museum', 'cinema', 'auditorium', 'festival', 'cultural_center', 'other']),
  primaryLanguage: z.enum(['ca', 'es', 'en']),
  plan: z.string().trim().min(2, 'Indica el plan contratado.'),
  websiteUrl: z.string().trim().url('La web debe ser una URL válida.').optional().or(z.literal('')),
  fallbackEmail: z.string().trim().email('El email de contacto no es válido.').optional().or(z.literal('')),
  fallbackPhone: z.string().trim().optional(),
  modules: z.array(z.enum(moduleKeys)).default(['chatbot', 'data']),
})

const updateTenantSchema = createTenantSchema.extend({
  tenantId: z.string().uuid(),
})

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function getAvailableSlug(admin: ReturnType<typeof createAdminClient>, name: string) {
  const base = slugify(name) || 'tenant'
  let candidate = base

  for (let index = 2; index < 100; index += 1) {
    const { data } = await admin
      .from('theatres')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (!data) return candidate
    candidate = `${base}-${index}`
  }

  return `${base}-${Date.now()}`
}

export async function createTenantAction(
  _previousState: CreateTenantState,
  formData: FormData
): Promise<CreateTenantState> {
  await requirePlatformAdmin()

  const modules = formData.getAll('modules').filter((value): value is string => typeof value === 'string')
  const parsed = createTenantSchema.safeParse({
    name: formData.get('name'),
    entityType: formData.get('entity_type') || 'theatre',
    primaryLanguage: formData.get('primary_language') || 'es',
    plan: formData.get('plan') || 'esencial',
    websiteUrl: formData.get('website_url') || '',
    fallbackEmail: formData.get('fallback_email') || '',
    fallbackPhone: formData.get('fallback_phone') || '',
    modules: modules.length ? modules : ['chatbot', 'data'],
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const admin = createAdminClient()
  const slug = await getAvailableSlug(admin, parsed.data.name)
  const scrapeUrls = parsed.data.websiteUrl ? [parsed.data.websiteUrl] : []

  const { data: tenant, error: tenantError } = await admin
    .from('theatres')
    .insert({
      name: parsed.data.name,
      slug,
      entity_type: parsed.data.entityType,
      primary_language: parsed.data.primaryLanguage,
      plan: parsed.data.plan,
      website_url: parsed.data.websiteUrl || null,
      fallback_email: parsed.data.fallbackEmail || null,
      fallback_phone: parsed.data.fallbackPhone || null,
      scrape_urls: scrapeUrls,
      widget_config: {
        assistantName: 'TALÍA',
        initialMessage:
          parsed.data.primaryLanguage === 'ca'
            ? 'Hola, soc TALÍA. En què et puc ajudar?'
            : 'Hola, soy TALÍA. ¿En qué puedo ayudarte?',
        primaryColor: '#000000',
      },
      voice_enabled: parsed.data.modules.includes('voice'),
      voice_language: parsed.data.primaryLanguage,
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    return { ok: false, message: tenantError?.message ?? 'No se ha podido crear el cliente.' }
  }

  const selectedModules = new Set(parsed.data.modules)
  selectedModules.add('chatbot')
  selectedModules.add('data')

  const moduleRows = moduleKeys.map((moduleKey) => ({
    theatre_id: tenant.id,
    module_key: moduleKey,
    status: selectedModules.has(moduleKey) ? 'active' : 'disabled',
    enabled_at: selectedModules.has(moduleKey) ? new Date().toISOString() : null,
  }))

  const { error: modulesError } = await admin.from('tenant_modules').insert(moduleRows)

  if (modulesError) {
    return {
      ok: false,
      message: `Cliente creado, pero no se pudieron crear los módulos: ${modulesError.message}`,
      tenantId: tenant.id,
    }
  }

  revalidatePath('/backstage')

  return {
    ok: true,
    message: 'Cliente creado. Ya puedes generar una invitación.',
    tenantId: tenant.id,
  }
}

export async function updateTenantAction(
  _previousState: UpdateTenantState,
  formData: FormData
): Promise<UpdateTenantState> {
  await requirePlatformAdmin()

  const modules = formData.getAll('modules').filter((value): value is string => typeof value === 'string')
  const parsed = updateTenantSchema.safeParse({
    tenantId: formData.get('tenant_id'),
    name: formData.get('name'),
    entityType: formData.get('entity_type') || 'theatre',
    primaryLanguage: formData.get('primary_language') || 'es',
    plan: formData.get('plan') || 'esencial',
    websiteUrl: formData.get('website_url') || '',
    fallbackEmail: formData.get('fallback_email') || '',
    fallbackPhone: formData.get('fallback_phone') || '',
    modules,
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const admin = createAdminClient()
  const { data } = parsed
  const selectedModules = new Set(data.modules)
  selectedModules.add('chatbot')
  selectedModules.add('data')

  const { error: tenantError } = await admin
    .from('theatres')
    .update({
      name: data.name,
      entity_type: data.entityType,
      primary_language: data.primaryLanguage,
      plan: data.plan,
      website_url: data.websiteUrl || null,
      fallback_email: data.fallbackEmail || null,
      fallback_phone: data.fallbackPhone || null,
      voice_enabled: selectedModules.has('voice'),
      voice_language: data.primaryLanguage,
    })
    .eq('id', data.tenantId)

  if (tenantError) {
    return { ok: false, message: `No se pudo actualizar el cliente: ${tenantError.message}` }
  }

  const moduleRows = moduleKeys.map((moduleKey) => {
    const active = selectedModules.has(moduleKey)

    return {
      theatre_id: data.tenantId,
      module_key: moduleKey,
      status: active ? 'active' : 'disabled',
      enabled_at: active ? new Date().toISOString() : null,
      disabled_at: active ? null : new Date().toISOString(),
    }
  })

  const { error: modulesError } = await admin
    .from('tenant_modules')
    .upsert(moduleRows, { onConflict: 'theatre_id,module_key' })

  if (modulesError) {
    return {
      ok: false,
      message: `Cliente actualizado, pero no se pudieron guardar los módulos: ${modulesError.message}`,
    }
  }

  revalidatePath('/backstage')
  revalidatePath(`/backstage/tenants/${data.tenantId}`)
  revalidatePath(`/${data.tenantId}/overview`)

  return { ok: true, message: 'Cliente actualizado correctamente.' }
}
