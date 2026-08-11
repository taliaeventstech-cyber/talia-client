'use server'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { hasPlatformPermission } from '@/lib/platform/permissions'
import { sendBillingCancellationNotification } from '@/lib/billing/cancellation-notification'
import { markSubscriptionCancelled, syncSubscriptionStatus } from '@/lib/billing/stripe-sync'
import {
  chatbotAiSettingsToWidgetConfig,
  normalizeChatbotAiSettings,
} from '@/lib/chatbot/ai-settings'
import { emailAgentSettingsToMetadata, normalizeEmailAgentSettings } from '@/lib/email/settings'
import { DEFAULT_MANAGED_WEB_QUOTA_LIMITS } from '@/lib/knowledge/web-source-quotas'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSubscription } from '@/lib/usage/service'
import { normalizeAllowedWidgetDomains } from '@/lib/widget/domain-allowlist'
import type { Json } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { optionalInternationalPhoneSchema } from '@/lib/phone/schema'
import { TENANT_LANGUAGES } from '@/lib/tenants/language'
import { cancelStripeSubscription, retrieveStripeSubscription } from '@/lib/stripe/server'

export type UpdateTenantState = {
  ok: boolean
  message: string
}

export type AdminBillingCancellationState = {
  ok: boolean
  message: string
}

export type DeleteAccountState = {
  ok: false
  message: string
}

const moduleKeys = ['web', 'data', 'voice', 'email', 'whatsapp', 'instagram', 'marketing'] as const
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
  primaryLanguage: z.enum(TENANT_LANGUAGES),
  plan: z.enum(['essential', 'professional', 'enterprise']),
  websiteUrl: z.string().trim().url('La web debe ser una URL válida.').optional().or(z.literal('')),
  fallbackEmail: z.string().trim().email('El email de contacto no es válido.').optional().or(z.literal('')),
  fallbackPhone: optionalInternationalPhoneSchema,
  modules: z.array(z.enum(moduleKeys)).default(['web', 'data']),
})

async function revalidateAccountVenuePaths(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
) {
  const { data: venues } = await admin
    .from('theatres')
    .select('id')
    .eq('account_id', accountId)

  revalidatePath('/backstage')
  for (const venue of venues ?? []) {
    revalidatePath(`/backstage/tenants/${venue.id}`)
  }
}

const deleteAccountSchema = z.object({
  accountId: z.string().uuid(),
})

const adminBillingCancellationSchema = z.object({
  accountId: z.string().uuid(),
  mode: z.enum(['period_end', 'immediate']),
  reason: z.string().trim().min(10, 'Explica el motivo con al menos 10 caracteres.').max(500),
  confirmation: z.string().trim(),
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
  chatbotAllowedDomains: z.string().trim().max(2000, 'La lista de dominios autorizados es demasiado larga.').optional(),
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

export async function deleteAccountAction(
  _previousState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const platformAccess = await requirePlatformAdmin()

  const parsed = deleteAccountSchema.safeParse({
    accountId: formData.get('account_id'),
  })

  if (!parsed.success) {
    return { ok: false, message: 'Account no válido.' }
  }

  const admin = createAdminClient()
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('id, name, metadata')
    .eq('id', parsed.data.accountId)
    .maybeSingle()

  if (accountError) {
    return { ok: false, message: `No se pudo comprobar la cuenta: ${accountError.message}` }
  }
  if (!account) {
    return { ok: false, message: 'La cuenta ya no existe.' }
  }

  const metadata = asJsonObject(account.metadata)
  const subscriptionId = typeof metadata.stripe_subscription_id === 'string'
    ? metadata.stripe_subscription_id
    : null
  if (subscriptionId) {
    try {
      const subscription = await retrieveStripeSubscription(subscriptionId)
      if (subscription.status !== 'canceled') {
        return {
          ok: false,
          message: 'Cancela inmediatamente la suscripción de Stripe antes de eliminar la cuenta.',
        }
      }
    } catch {
      return {
        ok: false,
        message: 'No se pudo verificar la suscripción de Stripe. No se ha eliminado la cuenta.',
      }
    }
  }

  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: account.id,
    actor_user_id: platformAccess.user.id,
    action: 'account.deletion_requested',
    target_type: 'account',
    target_id: account.id,
    metadata: { account_name: account.name },
  })
  if (auditError) {
    return { ok: false, message: `No se pudo registrar la eliminación: ${auditError.message}` }
  }

  const { error } = await admin
    .from('accounts')
    .delete()
    .eq('id', parsed.data.accountId)

  if (error) {
    return { ok: false, message: `No se pudo eliminar la cuenta: ${error.message}` }
  }

  await admin.from('audit_events').insert({
    account_id: null,
    actor_user_id: platformAccess.user.id,
    action: 'account.deleted',
    target_type: 'account',
    target_id: account.id,
    metadata: { account_name: account.name },
  })

  revalidatePath('/backstage')
  redirect('/backstage')
}

export async function cancelCustomerSubscriptionAction(
  _previousState: AdminBillingCancellationState,
  formData: FormData,
): Promise<AdminBillingCancellationState> {
  const platformAccess = await requirePlatformAdmin()
  if (!hasPlatformPermission(platformAccess.permissions, 'manage_customer_billing')) {
    return { ok: false, message: 'Esta acción está restringida a founders autorizados.' }
  }

  const parsed = adminBillingCancellationSchema.safeParse({
    accountId: formData.get('account_id'),
    mode: formData.get('mode'),
    reason: formData.get('reason'),
    confirmation: formData.get('confirmation'),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const expectedConfirmation = parsed.data.mode === 'immediate' ? 'CANCELAR AHORA' : 'CANCELAR'
  if (parsed.data.confirmation !== expectedConfirmation) {
    return { ok: false, message: `Escribe ${expectedConfirmation} para confirmar.` }
  }

  const admin = createAdminClient()
  const { data: account } = await admin
    .from('accounts')
    .select('id, name, billing_email, metadata')
    .eq('id', parsed.data.accountId)
    .maybeSingle()
  if (!account) return { ok: false, message: 'No se ha encontrado la cuenta.' }

  const metadata = asJsonObject(account.metadata)
  const subscriptionId = typeof metadata.stripe_subscription_id === 'string'
    ? metadata.stripe_subscription_id
    : null
  if (!subscriptionId) return { ok: false, message: 'La cuenta no tiene una suscripción de Stripe vinculada.' }

  try {
    const currentSubscription = await retrieveStripeSubscription(subscriptionId)
    if (currentSubscription.metadata?.account_id && currentSubscription.metadata.account_id !== account.id) {
      throw new Error('Stripe subscription account mismatch')
    }
    if (currentSubscription.status === 'canceled') {
      return { ok: false, message: 'La suscripción ya está cancelada.' }
    }
    if (parsed.data.mode === 'period_end' && currentSubscription.cancel_at_period_end) {
      return { ok: true, message: 'La cancelación al final del periodo ya estaba programada.' }
    }

    const subscription = await cancelStripeSubscription({
      subscriptionId,
      mode: parsed.data.mode,
    })

    if (parsed.data.mode === 'immediate') {
      await markSubscriptionCancelled(admin, subscription)
    } else {
      await syncSubscriptionStatus(admin, subscription)
    }

    const effectiveAt = parsed.data.mode === 'immediate'
      ? new Date().toISOString()
      : subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null
    const notification = await sendBillingCancellationNotification({
      accountName: account.name,
      billingEmail: account.billing_email,
      mode: parsed.data.mode,
      effectiveAt,
    })

    await admin.from('audit_events').insert({
      account_id: account.id,
      actor_user_id: platformAccess.user.id,
      action: parsed.data.mode === 'immediate'
        ? 'billing.subscription_cancelled_immediately'
        : 'billing.subscription_cancellation_scheduled',
      target_type: 'account',
      target_id: account.id,
      metadata: {
        subscription_id: subscriptionId,
        reason: parsed.data.reason,
        mode: parsed.data.mode,
        effective_at: effectiveAt,
        notification_status: notification.status,
      },
    })

    await revalidateAccountVenuePaths(admin, account.id)
    return {
      ok: true,
      message: parsed.data.mode === 'immediate'
        ? 'Suscripción cancelada inmediatamente.'
        : 'Cancelación programada al final del periodo.',
    }
  } catch (error) {
    await admin.from('audit_events').insert({
      account_id: account.id,
      actor_user_id: platformAccess.user.id,
      action: 'billing.subscription_cancellation_failed',
      target_type: 'account',
      target_id: account.id,
      metadata: {
        subscription_id: subscriptionId,
        reason: parsed.data.reason,
        mode: parsed.data.mode,
        error: error instanceof Error ? error.message.slice(0, 300) : 'unknown_error',
      },
    })
    return { ok: false, message: 'Stripe no ha podido cancelar la suscripción. Revisa el evento de auditoría.' }
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
    chatbotAllowedDomains: formData.get('chatbot_allowed_domains') || '',
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
  selectedModules.add('web')
  selectedModules.add('data')

  const { data: tenantForAccount } = await admin
    .from('theatres')
    .select('account_id, widget_config')
    .eq('id', data.tenantId)
    .maybeSingle()
  const currentWidgetConfig = tenantForAccount?.widget_config && typeof tenantForAccount.widget_config === 'object' && !Array.isArray(tenantForAccount.widget_config)
    ? tenantForAccount.widget_config as Record<string, Json>
    : {}
  const currentChatbotAi = normalizeChatbotAiSettings(currentWidgetConfig.chatbotAi ?? currentWidgetConfig.chatbot_ai)

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
        allowedDomains: normalizeAllowedWidgetDomains(data.chatbotAllowedDomains ?? ''),
        chatbotAi: chatbotAiSettingsToWidgetConfig(normalizeChatbotAiSettings({
          temperature: data.chatbotTemperature,
          groundingMode: data.chatbotGroundingMode,
          minContextScore: data.chatbotMinContextScore,
          maxContextItems: data.chatbotMaxContextItems,
          fallbackContacts: data.chatbotFallbackContacts,
          fallbackMessage: currentChatbotAi.fallbackMessage,
          fallbackWhatsApp: currentChatbotAi.fallbackWhatsApp,
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
  const { data: currentEntitlements } = await admin
    .from('tenant_module_entitlements')
    .select('module_key, limits')
    .eq('theatre_id', tenantId)
  const currentLimits = new Map((currentEntitlements ?? []).map((entry) => [entry.module_key, entry.limits]))
  const rows = moduleKeys.map((moduleKey) => ({
    theatre_id: tenantId,
    module_key: moduleKey,
    enabled: selectedModules.has(moduleKey),
    limits: {
      ...getDefaultModuleLimits(moduleKey),
      ...asJsonObject(currentLimits.get(moduleKey)),
    },
  }))

  await admin
    .from('tenant_module_entitlements')
    .upsert(rows, { onConflict: 'theatre_id,module_key' })
}

function asJsonObject(value: Json | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json>
    : {}
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
  if (moduleKey === 'web') return { monthly_conversations: 1000 }
  if (moduleKey === 'email') return { monthly_conversations: 0 }
  if (moduleKey === 'voice') return { monthly_minutes: 0 }
  if (moduleKey === 'data') {
    return {
      managed_web_sources: DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxSources,
      managed_web_documents: DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxDocuments,
      managed_web_pages_per_source: DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxPagesPerSource,
      managed_web_manual_syncs_per_day: DEFAULT_MANAGED_WEB_QUOTA_LIMITS.maxManualSyncsPerDay,
    }
  }
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
