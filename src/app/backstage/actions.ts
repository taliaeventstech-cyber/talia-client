'use server'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { createSignupInvite } from '@/lib/platform/invites'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSubscription } from '@/lib/usage/service'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type CreateTenantState = {
  ok: boolean
  message: string
  tenantId?: string
  accountId?: string
}

export type UpdateTenantState = {
  ok: boolean
  message: string
}

export type CreateAccountInviteState = {
  ok: boolean
  message: string
  inviteUrl?: string
}

const moduleKeys = ['chatbot', 'data', 'voice', 'email', 'whatsapp', 'instagram', 'marketing'] as const
const planDefaults = {
  essential: {
    includedChatConversations: 1000,
    includedEmailConversations: 0,
    includedVoiceMinutes: 0,
    overagePriceChatCents: 10,
    overagePriceEmailCents: 12,
    overagePriceVoiceMinuteCents: 35,
  },
  professional: {
    includedChatConversations: 4000,
    includedEmailConversations: 500,
    includedVoiceMinutes: 0,
    overagePriceChatCents: 8,
    overagePriceEmailCents: 10,
    overagePriceVoiceMinuteCents: 35,
  },
  enterprise: {
    includedChatConversations: 12000,
    includedEmailConversations: 2000,
    includedVoiceMinutes: 120,
    overagePriceChatCents: 6,
    overagePriceEmailCents: 8,
    overagePriceVoiceMinuteCents: 35,
  },
} as const

const createTenantSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  entityType: z.enum(['theatre', 'museum', 'cinema', 'auditorium', 'festival', 'cultural_center', 'other']),
  primaryLanguage: z.enum(['ca', 'es', 'en']),
  plan: z.enum(['essential', 'professional', 'enterprise']),
  websiteUrl: z.string().trim().url('La web debe ser una URL válida.').optional().or(z.literal('')),
  fallbackEmail: z.string().trim().email('El email de contacto no es válido.').optional().or(z.literal('')),
  fallbackPhone: z.string().trim().optional(),
  modules: z.array(z.enum(moduleKeys)).default(['chatbot', 'data']),
})

const createAccountSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  billingEmail: z.string().trim().email('El email de facturación no es válido.').optional().or(z.literal('')),
})

const createVenueSchema = createTenantSchema.extend({
  accountId: z.string().uuid(),
})

const deleteAccountSchema = z.object({
  accountId: z.string().uuid(),
})

const deleteInviteSchema = z.object({
  accountId: z.string().uuid(),
  inviteId: z.string().uuid(),
})

const createAccountInviteSchema = z.object({
  accountId: z.string().uuid(),
  theatreId: z.string().uuid().optional().or(z.literal('')),
  email: z.string().trim().email('El email no es válido.'),
  role: z.enum(['owner', 'admin', 'operator', 'analyst', 'viewer']),
})

const updateTenantSchema = createTenantSchema.extend({
  tenantId: z.string().uuid(),
  voicePhoneNumber: z.string().trim().max(20).optional(),
  voicePhoneProvider: z.enum(['elevenlabs', 'twilio', 'external']),
  voicePhoneMode: z.enum(['talia_number', 'client_forwarding', 'portability']),
  voicePublicPhoneNumber: z.string().trim().max(20).optional(),
  voiceForwardingNotes: z.string().trim().max(2000).optional(),
  voiceOperationalStatus: z.enum(['draft', 'provisioning', 'active', 'paused', 'error']),
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

async function getAvailableAccountSlug(admin: ReturnType<typeof createAdminClient>, name: string) {
  const base = slugify(name) || 'account'
  let candidate = base

  for (let index = 2; index < 100; index += 1) {
    const { data } = await admin
      .from('accounts')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (!data) return candidate
    candidate = `${base}-${index}`
  }

  return `${base}-${Date.now()}`
}

function getDefaultN8nWebhookUrl() {
  return process.env.DEFAULT_N8N_WEBHOOK_URL || null
}

async function createVenueForAccount(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    accountId: string
    plan: 'essential' | 'professional' | 'enterprise'
    name: string
    entityType: 'theatre' | 'museum' | 'cinema' | 'auditorium' | 'festival' | 'cultural_center' | 'other'
    primaryLanguage: 'ca' | 'es' | 'en'
    websiteUrl?: string
    fallbackEmail?: string
    fallbackPhone?: string
    modules: readonly (typeof moduleKeys)[number][]
  }
) {
  const slug = await getAvailableSlug(admin, input.name)
  const scrapeUrls = input.websiteUrl ? [input.websiteUrl] : []

  const { data: tenant, error: tenantError } = await admin
    .from('theatres')
    .insert({
      account_id: input.accountId,
      name: input.name,
      slug,
      entity_type: input.entityType,
      primary_language: input.primaryLanguage,
      plan: input.plan,
      website_url: input.websiteUrl || null,
      fallback_email: input.fallbackEmail || null,
      fallback_phone: input.fallbackPhone || null,
      scrape_urls: scrapeUrls,
      widget_config: {
        assistantName: 'TALÍA',
        initialMessage:
          input.primaryLanguage === 'ca'
            ? 'Hola, soc TALÍA. En què et puc ajudar?'
            : 'Hola, soy TALÍA. ¿En qué puedo ayudarte?',
        primaryColor: '#000000',
      },
      n8n_webhook_url: getDefaultN8nWebhookUrl(),
      voice_enabled: input.modules.includes('voice'),
      voice_language: input.primaryLanguage,
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    return { ok: false as const, message: tenantError?.message ?? 'No se ha podido crear la venue.' }
  }

  const selectedModules = new Set(input.modules)
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
      ok: false as const,
      message: `Venue creada, pero no se pudieron crear los módulos: ${modulesError.message}`,
      tenantId: tenant.id,
    }
  }

  await Promise.all([
    syncCurrentSubscription(admin, tenant.id, input.plan),
    syncModuleEntitlements(admin, tenant.id, selectedModules),
  ])

  return { ok: true as const, message: 'Venue creada correctamente.', tenantId: tenant.id }
}

export async function createTenantAction(
  _previousState: CreateTenantState,
  formData: FormData
): Promise<CreateTenantState> {
  await requirePlatformAdmin()

  const parsed = createAccountSchema.safeParse({
    name: formData.get('name'),
    billingEmail: formData.get('billing_email') || '',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const admin = createAdminClient()
  const slug = await getAvailableAccountSlug(admin, parsed.data.name)

  const { data: account, error: accountError } = await admin
    .from('accounts')
    .insert({
      name: parsed.data.name,
      slug,
      billing_email: parsed.data.billingEmail || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (accountError || !account) {
    return { ok: false, message: accountError?.message ?? 'No se ha podido crear la cuenta del cliente.' }
  }

  revalidatePath('/backstage')

  return {
    ok: true,
    message: 'Cliente creado. Ahora añade la primera venue para configurar TALÍA.',
    accountId: account.id,
  }
}

export async function createVenueAction(
  _previousState: CreateTenantState,
  formData: FormData
): Promise<CreateTenantState> {
  await requirePlatformAdmin()

  const modules = formData.getAll('modules').filter((value): value is string => typeof value === 'string')
  const parsed = createVenueSchema.safeParse({
    accountId: formData.get('account_id'),
    name: formData.get('name'),
    entityType: formData.get('entity_type') || 'theatre',
    primaryLanguage: formData.get('primary_language') || 'es',
    plan: formData.get('plan') || 'essential',
    websiteUrl: formData.get('website_url') || '',
    fallbackEmail: formData.get('fallback_email') || '',
    fallbackPhone: formData.get('fallback_phone') || '',
    modules: modules.length ? modules : ['chatbot', 'data'],
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const admin = createAdminClient()
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('id')
    .eq('id', parsed.data.accountId)
    .single()

  if (accountError || !account) {
    return { ok: false, message: accountError?.message ?? 'No se ha encontrado la cuenta.' }
  }

  const venue = await createVenueForAccount(admin, {
    accountId: account.id,
    plan: parsed.data.plan,
    name: parsed.data.name,
    entityType: parsed.data.entityType,
    primaryLanguage: parsed.data.primaryLanguage,
    websiteUrl: parsed.data.websiteUrl,
    fallbackEmail: parsed.data.fallbackEmail,
    fallbackPhone: parsed.data.fallbackPhone,
    modules: parsed.data.modules,
  })

  if (!venue.ok) return { ok: false, message: venue.message, tenantId: venue.tenantId, accountId: account.id }

  revalidatePath('/backstage')
  revalidatePath(`/backstage/accounts/${account.id}`)

  return {
    ok: true,
    message: 'Venue creada correctamente.',
    tenantId: venue.tenantId,
    accountId: account.id,
  }
}

export async function deleteAccountAction(formData: FormData) {
  await requirePlatformAdmin()

  const parsed = deleteAccountSchema.safeParse({
    accountId: formData.get('account_id'),
  })

  if (!parsed.success) {
    throw new Error('Account no válido.')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('accounts')
    .delete()
    .eq('id', parsed.data.accountId)

  if (error) {
    throw new Error(`No se pudo eliminar la cuenta: ${error.message}`)
  }

  revalidatePath('/backstage')
  redirect('/backstage')
}

export async function deleteInviteAction(formData: FormData) {
  await requirePlatformAdmin()

  const parsed = deleteInviteSchema.safeParse({
    accountId: formData.get('account_id'),
    inviteId: formData.get('invite_id'),
  })

  if (!parsed.success) {
    throw new Error('Invitación no válida.')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('signup_invites')
    .delete()
    .eq('id', parsed.data.inviteId)
    .eq('account_id', parsed.data.accountId)

  if (error) {
    throw new Error(`No se pudo borrar la invitación: ${error.message}`)
  }

  revalidatePath('/backstage')
  revalidatePath(`/backstage/accounts/${parsed.data.accountId}`)
}

export async function createAccountInviteAction(
  _previousState: CreateAccountInviteState,
  formData: FormData
): Promise<CreateAccountInviteState> {
  const platformAdmin = await requirePlatformAdmin()
  const parsed = createAccountInviteSchema.safeParse({
    accountId: formData.get('account_id'),
    theatreId: formData.get('theatre_id'),
    email: formData.get('email'),
    role: formData.get('role') || 'admin',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const admin = createAdminClient()
  const theatreId = parsed.data.theatreId || undefined
  const { data: theatre, error: theatreError } = theatreId
    ? await admin
      .from('theatres')
      .select('id')
      .eq('id', theatreId)
      .eq('account_id', parsed.data.accountId)
      .maybeSingle()
    : { data: null, error: null }

  if (theatreId && (theatreError || !theatre)) {
    return { ok: false, message: theatreError?.message ?? 'La venue no pertenece a este account.' }
  }

  const invite = await createSignupInvite(admin, {
    accountId: parsed.data.accountId,
    theatreId,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: platformAdmin.user.id,
  })

  if (!invite.ok) {
    return { ok: false, message: invite.error }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  revalidatePath('/backstage')
  revalidatePath(`/backstage/accounts/${parsed.data.accountId}`)

  return {
    ok: true,
    message: 'Invitación creada. Copia este enlace ahora; el token no se guarda en claro.',
    inviteUrl: `${appUrl}/signup?invite=${invite.token}`,
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
    plan: formData.get('plan') || 'essential',
    websiteUrl: formData.get('website_url') || '',
    fallbackEmail: formData.get('fallback_email') || '',
    fallbackPhone: formData.get('fallback_phone') || '',
    voicePhoneNumber: String(formData.get('voice_phone_number') ?? '').trim() || undefined,
    voicePhoneProvider: formData.get('voice_phone_provider') || 'elevenlabs',
    voicePhoneMode: formData.get('voice_phone_mode') || 'talia_number',
    voicePublicPhoneNumber: String(formData.get('voice_public_phone_number') ?? '').trim() || undefined,
    voiceForwardingNotes: String(formData.get('voice_forwarding_notes') ?? '').trim() || undefined,
    voiceOperationalStatus: formData.get('voice_operational_status') || 'draft',
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

  const { data: tenantForAccount } = await admin
    .from('theatres')
    .select('account_id')
    .eq('id', data.tenantId)
    .maybeSingle()

  const { error: accountError } = tenantForAccount?.account_id
    ? await admin
      .from('accounts')
      .update({
        name: data.name,
        billing_email: data.fallbackEmail || null,
        plan: data.plan,
      })
      .eq('id', tenantForAccount.account_id)
    : { error: null }

  if (accountError) {
    return { ok: false, message: `No se pudo actualizar la cuenta: ${accountError.message}` }
  }

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
      voice_phone_number: data.voicePhoneNumber || null,
      voice_phone_provider: data.voicePhoneProvider,
      voice_phone_mode: data.voicePhoneMode,
      voice_public_phone_number: data.voicePublicPhoneNumber || null,
      voice_forwarding_notes: data.voiceForwardingNotes || null,
      voice_operational_status: data.voiceOperationalStatus,
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

  await Promise.all([
    syncCurrentSubscription(admin, data.tenantId, data.plan),
    syncModuleEntitlements(admin, data.tenantId, selectedModules),
  ])

  revalidatePath('/backstage')
  revalidatePath(`/backstage/tenants/${data.tenantId}`)
  revalidatePath(`/${data.tenantId}/overview`)

  return { ok: true, message: 'Cliente actualizado correctamente.' }
}

async function syncModuleEntitlements(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  selectedModules: Set<(typeof moduleKeys)[number]>,
) {
  const rows = moduleKeys.map((moduleKey) => ({
    theatre_id: tenantId,
    module_key: moduleKey,
    enabled: selectedModules.has(moduleKey),
    limits: getDefaultModuleLimits(moduleKey),
  }))

  await admin
    .from('tenant_module_entitlements')
    .upsert(rows, { onConflict: 'theatre_id,module_key' })
}

function getDefaultModuleLimits(moduleKey: (typeof moduleKeys)[number]) {
  if (moduleKey === 'chatbot') return { monthly_conversations: 1000 }
  if (moduleKey === 'email') return { monthly_conversations: 0 }
  if (moduleKey === 'voice') return { monthly_minutes: 0 }
  return {}
}

async function syncCurrentSubscription(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  plan: keyof typeof planDefaults,
) {
  const subscription = await getActiveSubscription(admin, tenantId)
  if (!subscription.ok) return

  const defaults = planDefaults[plan]
  await admin
    .from('tenant_subscriptions')
    .update({
      plan,
      included_chat_conversations: defaults.includedChatConversations,
      included_email_conversations: defaults.includedEmailConversations,
      included_voice_minutes: defaults.includedVoiceMinutes,
      overage_price_chat_cents: defaults.overagePriceChatCents,
      overage_price_email_cents: defaults.overagePriceEmailCents,
      overage_price_voice_minute_cents: defaults.overagePriceVoiceMinuteCents,
    })
    .eq('id', subscription.subscription.id)
}
