'use server'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  chatbotAiSettingsToWidgetConfig,
  normalizeChatbotAiSettings,
} from '@/lib/chatbot/ai-settings'
import { emailAgentSettingsToMetadata, normalizeEmailAgentSettings } from '@/lib/email/settings'
import { createSignupInvite } from '@/lib/platform/invites'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSubscription } from '@/lib/usage/service'
import type { Json } from '@/types/database.types'
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
  chatbotWebhookUrl: z.string().trim().url('El webhook del chatbot debe ser una URL válida.').optional().or(z.literal('')),
  chatbotSystemPrompt: z.string().trim().max(4000, 'El prompt del chatbot es demasiado largo.').optional(),
  chatbotTemperature: z.coerce.number().min(0).max(1),
  chatbotGroundingMode: z.enum(['strict', 'balanced']),
  chatbotMinContextScore: z.coerce.number().min(0).max(1),
  chatbotMaxContextItems: z.coerce.number().int().min(1).max(10),
  chatbotFallbackContacts: z.boolean().default(true),
  emailMailboxEmail: z.string().trim().email('El buzón de email no es válido.').optional().or(z.literal('')),
  emailProvider: z.enum(['google', 'microsoft', 'imap', 'forwarding']),
  emailStatus: z.enum(['draft', 'connected', 'syncing', 'error', 'revoked', 'disabled']),
  emailDraftMode: z.enum(['provider_drafts', 'agora_review', 'disabled']),
  emailSyncMode: z.enum(['polling', 'webhook', 'manual']),
  emailSyncWindowDays: z.coerce.number().int().refine((value) => [1, 7, 14, 30].includes(value), {
    message: 'La ventana de lectura de email no es válida.',
  }),
  emailSyncFrequencyMinutes: z.coerce.number().int().refine((value) => [15, 30, 60, 240].includes(value), {
    message: 'La frecuencia automática de email no es válida.',
  }),
  emailSyncLimit: z.coerce.number().int().refine((value) => [10, 25, 50, 100, 250, 500].includes(value), {
    message: 'El límite de sincronización de email no es válido.',
  }),
  emailCronEnabled: z.boolean().default(true),
  emailAutoProcessAfterSync: z.boolean().default(false),
  emailAutoClassifyAfterSync: z.boolean().default(false),
  emailAutoDraftAfterSync: z.boolean().default(false),
  emailExcludeAutomated: z.boolean().default(true),
  emailBlockedSenders: z.string().trim().max(2000).optional(),
  emailBlockedDomains: z.string().trim().max(2000).optional(),
  emailGmailSyncQuery: z.string().trim().max(240, 'La query avanzada de Gmail es demasiado larga.').optional(),
  emailAgentTone: z.enum(['professional_cercano', 'formal', 'directo']),
  emailAgentDraftStyle: z.enum(['breve', 'detallado']),
  emailAgentSignature: z.string().trim().max(500, 'La firma del agente de email es demasiado larga.').optional(),
  emailChannelPrompt: z.string().trim().max(4000, 'El prompt del agente de email es demasiado largo.').optional(),
  emailClassificationTopics: z.string().trim().max(1500, 'Los temas de clasificación son demasiado largos.').optional(),
  emailHumanReviewTopics: z.string().trim().max(1000, 'Los temas de revisión humana son demasiado largos.').optional(),
  emailClassificationRules: z.string().trim().max(2000, 'Las reglas de clasificación son demasiado largas.').optional(),
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
    syncEmailConnection(admin, tenant.id, {
      enabled: selectedModules.has('email'),
      mailboxEmail: input.fallbackEmail,
      provider: 'google',
      status: 'draft',
      draftMode: 'provider_drafts',
      syncMode: 'polling',
    }),
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
    inviteUrl: `${appUrl}/invite/${invite.token}`,
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
    chatbotWebhookUrl: formData.get('chatbot_webhook_url') || '',
    chatbotSystemPrompt: formData.get('chatbot_system_prompt') || '',
    chatbotTemperature: formData.get('chatbot_temperature') || '0.2',
    chatbotGroundingMode: formData.get('chatbot_grounding_mode') || 'strict',
    chatbotMinContextScore: formData.get('chatbot_min_context_score') || '0.3',
    chatbotMaxContextItems: formData.get('chatbot_max_context_items') || '5',
    chatbotFallbackContacts: formData.get('chatbot_fallback_contacts') === 'on',
    emailMailboxEmail: formData.get('email_mailbox_email') || '',
    emailProvider: formData.get('email_provider') || 'google',
    emailStatus: formData.get('email_status') || 'draft',
    emailDraftMode: formData.get('email_draft_mode') || 'provider_drafts',
    emailSyncMode: formData.get('email_sync_mode') || 'polling',
    emailSyncWindowDays: formData.get('email_sync_window_days') || '14',
    emailSyncFrequencyMinutes: formData.get('email_sync_frequency_minutes') || '15',
    emailSyncLimit: formData.get('email_sync_limit') || '100',
    emailCronEnabled: formData.get('email_cron_enabled') === 'on',
    emailAutoProcessAfterSync: formData.get('email_auto_process_after_sync') === 'on',
    emailAutoClassifyAfterSync: formData.get('email_auto_classify_after_sync') === 'on',
    emailAutoDraftAfterSync: formData.get('email_auto_draft_after_sync') === 'on',
    emailExcludeAutomated: formData.get('email_exclude_automated') === 'on',
    emailBlockedSenders: formData.get('email_blocked_senders') || '',
    emailBlockedDomains: formData.get('email_blocked_domains') || '',
    emailGmailSyncQuery: formData.get('email_gmail_sync_query') || '',
    emailAgentTone: formData.get('email_agent_tone') || 'professional_cercano',
    emailAgentDraftStyle: formData.get('email_agent_draft_style') || 'breve',
    emailAgentSignature: formData.get('email_agent_signature') || '',
    emailChannelPrompt: formData.get('email_channel_prompt') || '',
    emailClassificationTopics: formData.get('email_classification_topics') || '',
    emailHumanReviewTopics: formData.get('email_human_review_topics') || '',
    emailClassificationRules: formData.get('email_classification_rules') || '',
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
    .select('account_id, widget_config')
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
      n8n_webhook_url: data.chatbotWebhookUrl || null,
      system_prompt: data.chatbotSystemPrompt || null,
      widget_config: mergeWidgetConfig(tenantForAccount?.widget_config, {
        chatbotAi: chatbotAiSettingsToWidgetConfig(normalizeChatbotAiSettings({
          temperature: data.chatbotTemperature,
          groundingMode: data.chatbotGroundingMode,
          minContextScore: data.chatbotMinContextScore,
          maxContextItems: data.chatbotMaxContextItems,
          fallbackContacts: data.chatbotFallbackContacts,
        })),
      }),
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
    syncEmailConnection(admin, data.tenantId, {
      enabled: selectedModules.has('email'),
      mailboxEmail: data.emailMailboxEmail,
      provider: data.emailProvider,
      status: data.emailStatus,
      draftMode: data.emailDraftMode,
      syncMode: data.emailSyncMode,
      syncWindowDays: data.emailSyncWindowDays,
      syncFrequencyMinutes: data.emailSyncFrequencyMinutes,
      syncLimit: data.emailSyncLimit,
      cronEnabled: data.emailCronEnabled,
      autoProcessAfterSync: data.emailAutoProcessAfterSync,
      autoClassifyAfterSync: data.emailAutoClassifyAfterSync,
      autoDraftAfterSync: data.emailAutoDraftAfterSync,
      excludeAutomated: data.emailExcludeAutomated,
      blockedSenders: parseEmailRuleList(data.emailBlockedSenders),
      blockedDomains: parseEmailRuleList(data.emailBlockedDomains),
      gmailSyncQuery: data.emailGmailSyncQuery,
      agentSettings: normalizeEmailAgentSettings({
        tone: data.emailAgentTone,
        draftStyle: data.emailAgentDraftStyle,
        signature: data.emailAgentSignature,
        channelPrompt: data.emailChannelPrompt,
        classificationTopics: parseEmailRuleList(data.emailClassificationTopics),
        humanReviewTopics: parseEmailRuleList(data.emailHumanReviewTopics),
        classificationRules: data.emailClassificationRules,
      }),
    }),
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

async function syncEmailConnection(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  input: {
    enabled: boolean
    mailboxEmail?: string
    provider: 'google' | 'microsoft' | 'imap' | 'forwarding'
    status: 'draft' | 'connected' | 'syncing' | 'error' | 'revoked' | 'disabled'
    draftMode: 'provider_drafts' | 'agora_review' | 'disabled'
    syncMode: 'polling' | 'webhook' | 'manual'
    syncWindowDays?: number
    syncFrequencyMinutes?: number
    syncLimit?: number
    cronEnabled?: boolean
    autoProcessAfterSync?: boolean
    autoClassifyAfterSync?: boolean
    autoDraftAfterSync?: boolean
    excludeAutomated?: boolean
    blockedSenders?: string[]
    blockedDomains?: string[]
    gmailSyncQuery?: string
    agentSettings?: ReturnType<typeof normalizeEmailAgentSettings>
  },
) {
  const { data: existingConnections } = await admin
    .from('email_connections')
    .select('id, mailbox_email, metadata')
    .eq('theatre_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)

  const existing = existingConnections?.[0] ?? null

  if (!input.enabled) {
    if (!existing) return

    await admin
      .from('email_connections')
      .update({
        status: 'disabled',
        error_message: null,
      })
      .eq('id', existing.id)

    return
  }

  const mailboxEmail = input.mailboxEmail?.trim().toLowerCase()
  if (!mailboxEmail) return
  const metadata = buildEmailConnectionMetadata(existing?.metadata, input)

  const payload = {
    theatre_id: tenantId,
    mailbox_email: mailboxEmail,
    provider: input.provider,
    status: input.status,
    draft_mode: input.draftMode,
    sync_mode: input.syncMode,
    error_message: input.status === 'error' ? 'Revisar conexión OAuth o permisos del buzón.' : null,
    metadata,
  }

  if (existing) {
    await admin
      .from('email_connections')
      .update(payload)
      .eq('id', existing.id)

    return
  }

  await admin
    .from('email_connections')
    .insert(payload)
}

function buildEmailConnectionMetadata(
  current: Json | undefined,
  input: {
    syncWindowDays?: number
    syncFrequencyMinutes?: number
    syncLimit?: number
    cronEnabled?: boolean
    autoProcessAfterSync?: boolean
    autoClassifyAfterSync?: boolean
    autoDraftAfterSync?: boolean
    excludeAutomated?: boolean
    blockedSenders?: string[]
    blockedDomains?: string[]
    gmailSyncQuery?: string
    agentSettings?: ReturnType<typeof normalizeEmailAgentSettings>
  },
) {
  const currentRecord = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, Json | undefined>
    : {}
  const syncWindowDays = input.syncWindowDays && [1, 7, 14, 30].includes(input.syncWindowDays)
    ? input.syncWindowDays
    : 14
  const syncLimit = input.syncLimit && [10, 25, 50, 100, 250, 500].includes(input.syncLimit)
    ? input.syncLimit
    : 100
  const syncFrequencyMinutes = input.syncFrequencyMinutes && [15, 30, 60, 240].includes(input.syncFrequencyMinutes)
    ? input.syncFrequencyMinutes
    : 15
  const advancedQuery = input.gmailSyncQuery?.trim()

  return {
    ...currentRecord,
    gmail_sync_window_days: syncWindowDays,
    sync_frequency_minutes: syncFrequencyMinutes,
    gmail_sync_limit: syncLimit,
    cron_enabled: input.cronEnabled !== false,
    auto_process_after_sync: input.autoClassifyAfterSync === true && input.autoDraftAfterSync === true,
    auto_classify_after_sync: input.autoClassifyAfterSync === true,
    auto_draft_after_sync: input.autoDraftAfterSync === true,
    exclude_automated: input.excludeAutomated !== false,
    blocked_senders: input.blockedSenders ?? [],
    blocked_domains: input.blockedDomains ?? [],
    gmail_sync_query: advancedQuery || null,
    email_agent_settings: emailAgentSettingsToMetadata(input.agentSettings ?? normalizeEmailAgentSettings({})),
  } satisfies Json
}

function mergeWidgetConfig(current: Json | undefined, next: Record<string, unknown>): Json {
  const currentRecord = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, Json>
    : {}

  return {
    ...currentRecord,
    ...next,
  } as Json
}

function parseEmailRuleList(value: string | undefined) {
  if (!value) return []

  return value
    .split(/[\n,;]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50)
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
