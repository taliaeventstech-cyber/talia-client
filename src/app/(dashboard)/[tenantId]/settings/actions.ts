'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { importPdfKnowledgeSource, reindexStructuredKnowledgeSource } from '@/lib/knowledge/ingestion'
import { embedKnowledgeSourceWithTaliaAi } from '@/lib/knowledge/talia-ai-embeddings'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import { updateTenantSettings as updateTenantSettingsRecord } from '@/lib/tenants/settings'
import { normalizeAllowedWidgetDomains } from '@/lib/widget/domain-allowlist'
import {
  chatbotAiSettingsToWidgetConfig,
  normalizeChatbotAiSettings,
} from '@/lib/chatbot/ai-settings'
import type { Json } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { optionalInternationalPhoneSchema } from '@/lib/phone/schema'
import { getTenantContentHosts } from '@/lib/widget/domain-allowlist'
import { normalizePrivacyUrl } from '@/lib/widget/compliance'
import {
  getNextKnowledgeSyncAt,
  isKnowledgeRefreshInterval,
  isManagedWebSourceType,
  validateManagedWebSourceInput,
} from '@/lib/knowledge/managed-web-sources'
import { getManagedWebQuotaUsage, isManagedWebQuotaError } from '@/lib/knowledge/web-source-quotas'
import { sendKnowledgeSourceSupportNotification } from '@/lib/support/knowledge-source-notification'
import { randomUUID } from 'node:crypto'
import {
  normalizeInstalledWebCaptureSettings,
  type InstalledWebCaptureSettings,
} from '@/lib/knowledge/installed-web-capture-settings'
import { parseKnowledgeSpreadsheet } from '@/lib/knowledge/spreadsheet'
import {
  mergeSuggestedQuestionsIntoWidgetConfig,
  parseSuggestedQuestionsFormValue,
} from '@/lib/widget/suggested-questions'

export type SettingsFormState = {
  ok: boolean
  message: string
}

const settingsSchema = z.object({
  widgetEnabled: z.boolean(),
  initialMessage: z.string().trim().min(1, 'El mensaje inicial es obligatorio').max(300),
  privacyUrl: z.string().trim().max(2048).refine((value) => {
    if (!value) return true
    try {
      return new URL(value).protocol === 'https:'
    } catch {
      return false
    }
  }, 'La URL de privacidad debe ser una URL https válida.'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe estar en formato hexadecimal'),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
  widgetSize: z.enum(['small', 'medium', 'large']),
  inlineOffset: z.coerce.number().int().min(12).max(320),
  blockOffset: z.coerce.number().int().min(12).max(320),
  collisionStrategy: z.enum(['auto', 'none']),
  widgetTheme: z.enum(['solid', 'glass']),
  launcherIcon: z.enum(['talia', 'chat', 'bubble', 'bot']),
  glassBackground: z.enum(['light', 'dark']),
  glassBlur: z.coerce.number().int().min(0).max(30),
  glassTranslucency: z.coerce.number().int().min(15).max(85),
  fallbackEmail: z.string().trim().email('El email no es válido').optional().or(z.literal('')),
  fallbackPhone: optionalInternationalPhoneSchema,
  fallbackMessage: z.string().trim().max(1000, 'El mensaje fallback no puede superar los 1000 caracteres').optional(),
  fallbackWhatsApp: z.boolean(),
  autoOpen: z.boolean(),
  autoOpenDelay: z.coerce.number().int().min(0).max(60),
  proactiveMessage: z.string().trim().min(1, 'El saludo proactivo es obligatorio').max(160),
  allowedDomains: z.string().trim().max(2000).optional(),
  systemPrompt: z.string().trim().max(8000, 'El prompt no puede superar los 8000 caracteres').optional(),
})

const knowledgeItemSchema = z.object({
  question: z.string().trim().min(4, 'La pregunta debe tener al menos 4 caracteres').max(500),
  answer: z.string().trim().min(4, 'La respuesta debe tener al menos 4 caracteres').max(4000),
  category: z.string().trim().max(80).optional(),
  language: z.enum(['es', 'ca', 'en', 'pt-BR']),
  priority: z.coerce.number().int().min(0).max(100),
})

const knowledgeSourceSupportSchema = z.object({
  sourceId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  message: z.string().trim().min(10).max(2000),
})

export type ManagedWebSourceState = SettingsFormState

export type InstalledWebCaptureSettingsState = SettingsFormState & {
  settings?: InstalledWebCaptureSettings
}

const installedWebCaptureSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['manual', 'automatic']),
})

export async function updateInstalledWebCaptureSettings(
  tenantId: string,
  _previousState: InstalledWebCaptureSettingsState,
  formData: FormData,
): Promise<InstalledWebCaptureSettingsState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  if (!await assertTenantAdmin(admin, user.id, tenantId)) {
    return { ok: false, message: 'No tienes permisos para editar esta configuración.' }
  }

  const parsed = installedWebCaptureSchema.safeParse({
    enabled: formData.get('installed_web_capture_enabled') === 'on',
    mode: formData.get('installed_web_capture_mode') === 'automatic' ? 'automatic' : 'manual',
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La configuración no es válida.' }
  }

  const existingWidget = await getExistingWidgetConfig(admin, tenantId)
  const settings = normalizeInstalledWebCaptureSettings(parsed.data)
  const { error } = await admin
    .from('theatres')
    .update({
      widget_config: {
        ...existingWidget,
        installedWebCapture: settings,
      },
    })
    .eq('id', tenantId)

  if (error) return { ok: false, message: `No se pudo guardar: ${error.message}` }

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/settings`)
  return { ok: true, message: 'Configuración de captura actualizada.', settings }
}

export async function updateTenantSettings(
  tenantId: string,
  _previousState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireTenantProductAccess(tenantId, 'manage_chatbot', 'chatbot')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)

  if (!isAdmin) {
    return { ok: false, message: 'No tienes permisos para editar esta configuración.' }
  }

  const suggestedQuestions = parseSuggestedQuestionsFormValue(formData.get('suggested_questions'))
  if (!suggestedQuestions.ok) {
    return { ok: false, message: suggestedQuestions.error }
  }

  const parsed = settingsSchema.safeParse({
    widgetEnabled: formData.get('widget_enabled') === 'on',
    initialMessage: formData.get('initial_message'),
    privacyUrl: String(formData.get('privacy_url') ?? '').trim(),
    primaryColor: formData.get('primary_color'),
    position: formData.get('position') || 'bottom-right',
    widgetSize: formData.get('widget_size') || 'medium',
    inlineOffset: formData.get('inline_offset') ?? 20,
    blockOffset: formData.get('block_offset') ?? 20,
    collisionStrategy: formData.get('collision_strategy') === 'auto' ? 'auto' : 'none',
    widgetTheme: formData.get('widget_theme') === 'glass' ? 'glass' : 'solid',
    launcherIcon: normalizeLauncherIconFormValue(formData.get('launcher_icon')),
    glassBackground: formData.get('glass_background') === 'dark' ? 'dark' : 'light',
    glassBlur: formData.get('glass_blur') ?? 18,
    glassTranslucency: formData.get('glass_translucency') ?? 58,
    fallbackEmail: String(formData.get('fallback_email') ?? '').trim(),
    fallbackPhone: String(formData.get('fallback_phone') ?? '').trim(),
    fallbackMessage: String(formData.get('fallback_message') ?? '').trim(),
    fallbackWhatsApp: formData.get('fallback_whatsapp') === 'on',
    autoOpen: formData.get('auto_open') === 'on',
    autoOpenDelay: formData.get('auto_open_delay') ?? 3,
    proactiveMessage: String(formData.get('proactive_message') ?? '').trim(),
    allowedDomains: String(formData.get('allowed_domains') ?? '').trim(),
    systemPrompt: String(formData.get('system_prompt') ?? '').trim(),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La configuración no es válida.' }
  }

  const { data } = parsed
  const existingWidget = await getExistingWidgetConfig(admin, tenantId)
  const existingAiSettings = normalizeChatbotAiSettings(existingWidget.chatbotAi ?? existingWidget.chatbot_ai)
  const updated = await updateTenantSettingsRecord(admin, tenantId, {
    systemPrompt: data.systemPrompt,
    fallbackEmail: data.fallbackEmail,
    fallbackPhone: data.fallbackPhone,
    widgetConfig: mergeSuggestedQuestionsIntoWidgetConfig({
      ...existingWidget,
      enabled: data.widgetEnabled,
      assistantName: 'TALIA',
      initialMessage: data.initialMessage,
      privacyUrl: normalizePrivacyUrl(data.privacyUrl),
      primaryColor: data.primaryColor,
      position: data.position,
      widgetSize: data.widgetSize,
      inlineOffset: data.inlineOffset,
      blockOffset: data.blockOffset,
      collisionStrategy: data.collisionStrategy,
      widgetTheme: data.widgetTheme,
      launcherIcon: data.launcherIcon,
      glassBackground: data.glassBackground,
      glassBlur: data.glassBlur,
      glassTranslucency: data.glassTranslucency,
      autoOpen: data.autoOpen,
      autoOpenDelay: data.autoOpenDelay,
      proactiveMessage: data.proactiveMessage,
      allowedDomains: normalizeAllowedWidgetDomains(data.allowedDomains ?? ''),
      chatbotAi: chatbotAiSettingsToWidgetConfig({
        ...existingAiSettings,
        fallbackMessage: data.fallbackMessage || null,
        fallbackWhatsApp: data.fallbackWhatsApp,
      }),
    }, suggestedQuestions.questions),
  })

  if (!updated.ok) {
    return { ok: false, message: `No se pudo guardar: ${updated.error}` }
  }

  revalidatePath(`/${tenantId}/settings`)
  revalidatePath(`/${tenantId}/overview`)
  return { ok: true, message: 'Configuración guardada correctamente.' }
}

async function getExistingWidgetConfig(admin: ReturnType<typeof createAdminClient>, tenantId: string) {
  const { data } = await admin
    .from('theatres')
    .select('widget_config')
    .eq('id', tenantId)
    .single()

  return isPlainObject(data?.widget_config)
    ? data.widget_config as Record<string, Json>
    : {}
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLauncherIconFormValue(value: FormDataEntryValue | null) {
  return value === 'chat' || value === 'bubble' || value === 'bot' ? value : 'talia'
}

export async function createKnowledgeItem(
  tenantId: string,
  _previousState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)

  if (!isAdmin) {
    return { ok: false, message: 'No tienes permisos para editar esta fuente.' }
  }

  const parsed = knowledgeItemSchema.safeParse({
    question: formData.get('question'),
    answer: formData.get('answer'),
    category: formData.get('category'),
    language: formData.get('language') || 'es',
    priority: formData.get('priority') || 0,
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La FAQ no es válida.' }
  }

  const source = await getOrCreateManualKnowledgeSource(admin, tenantId)
  if (!source.ok) {
    return { ok: false, message: source.error }
  }

  const { data } = parsed
  const { error } = await admin
    .from('knowledge_items')
    .insert({
      theatre_id: tenantId,
      source_id: source.id,
      question: data.question,
      answer: data.answer,
      category: data.category || null,
      language: data.language,
      priority: data.priority,
      active: true,
    })

  if (error) {
    return { ok: false, message: `No se pudo guardar la FAQ: ${error.message}` }
  }

  const indexed = await reindexStructuredKnowledgeSource({
    admin,
    tenantId,
    sourceId: source.id,
    sourceType: 'manual',
    sourceName: 'FAQs manuales',
  })

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    message: indexed.ok
      ? 'FAQ añadida e indexada correctamente.'
      : `FAQ añadida. Pendiente de indexar en RAG: ${indexed.message}`,
  }
}

export async function createManagedWebKnowledgeSource(
  tenantId: string,
  _previousState: ManagedWebSourceState,
  formData: FormData
): Promise<ManagedWebSourceState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  if (!await assertTenantAdmin(admin, user.id, tenantId)) {
    return { ok: false, message: 'No tienes permisos para añadir esta fuente.' }
  }

  const { data: theatre, error: theatreError } = await admin
    .from('theatres')
    .select('website_url, widget_config')
    .eq('id', tenantId)
    .maybeSingle()

  if (theatreError || !theatre) {
    return { ok: false, message: 'No se pudo validar el dominio del espacio.' }
  }

  const quota = await getManagedWebQuotaUsage(admin, tenantId)
  if (quota.sources >= quota.limits.maxSources) {
    return {
      ok: false,
      message: `Has alcanzado el límite de ${quota.limits.maxSources} fuentes web gestionadas.`,
    }
  }
  if (quota.documents >= quota.limits.maxDocuments) {
    return {
      ok: false,
      message: `Has alcanzado el límite de ${quota.limits.maxDocuments} páginas web activas.`,
    }
  }

  const parsed = validateManagedWebSourceInput({
    name: formData.get('name'),
    sourceType: formData.get('source_type'),
    sourceUrl: formData.get('source_url'),
    refreshInterval: formData.get('refresh_interval'),
    authorizedHosts: getTenantContentHosts({
      websiteUrl: theatre.website_url,
      widgetConfig: theatre.widget_config,
    }),
  })

  if (!parsed.ok) return { ok: false, message: parsed.error }

  const now = new Date().toISOString()
  const created = await admin
    .from('knowledge_sources')
    .insert({
      theatre_id: tenantId,
      type: parsed.data.sourceType,
      name: parsed.data.name,
      source_url: parsed.data.sourceUrl,
      status: 'pending',
      sync_enabled: false,
      refresh_interval: parsed.data.refreshInterval,
      next_sync_at: now,
      config: {
        discovery_mode: parsed.data.sourceType,
        original_url: parsed.data.originalUrl,
        max_pages: quota.limits.maxPagesPerSource,
        capture_waterfall: ['http', 'browser', 'installed_widget', 'manual_browser'],
      },
    })
    .select('id')
    .single()

  if (created.error || !created.data) {
    const duplicate = created.error?.code === '23505'
    const quotaError = isManagedWebQuotaError(created.error)
    return {
      ok: false,
      message: quotaError === 'managed_web_source_quota_exceeded'
        ? `Has alcanzado el límite de ${quota.limits.maxSources} fuentes web gestionadas.`
        : quotaError === 'managed_web_document_quota_exceeded'
          ? `Has alcanzado el límite de ${quota.limits.maxDocuments} páginas web activas.`
          : duplicate
        ? 'Esta fuente web ya está configurada.'
        : `No se pudo crear la fuente: ${created.error?.message ?? 'error desconocido'}`,
    }
  }

  const queued = await admin
    .from('knowledge_sync_runs')
    .insert({
      theatre_id: tenantId,
      source_id: created.data.id,
      trigger: 'initial',
      status: 'queued',
      idempotency_key: `initial:${created.data.id}`,
    })

  revalidatePath(`/${tenantId}/knowledge`)
  return {
    ok: true,
    message: queued.error
      ? 'Fuente creada y pausada. El equipo de TALIA debe activarla desde Backstage.'
      : 'Fuente creada. La sincronización inicial queda en espera de activación supervisada.',
  }
}

export async function requestManagedWebSourceSync(
  tenantId: string,
  sourceId: string
): Promise<SettingsFormState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  if (!await assertTenantAdmin(admin, user.id, tenantId)) {
    return { ok: false, message: 'No tienes permisos para actualizar esta fuente.' }
  }

  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id, type, sync_enabled')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError || !source || !isManagedWebSourceType(source.type)) {
    return { ok: false, message: 'Fuente web no encontrada.' }
  }
  if (!source.sync_enabled) {
    return { ok: false, message: 'La sincronización está pausada por el equipo de TALIA.' }
  }

  const quota = await getManagedWebQuotaUsage(admin, tenantId)
  if (quota.manualSyncsToday >= quota.limits.maxManualSyncsPerDay) {
    return {
      ok: false,
      message: `Has alcanzado el límite diario de ${quota.limits.maxManualSyncsPerDay} actualizaciones manuales.`,
    }
  }

  const existing = await admin
    .from('knowledge_sync_runs')
    .select('id')
    .eq('source_id', sourceId)
    .in('status', ['queued', 'running'])
    .maybeSingle()

  if (existing.data) return { ok: true, message: 'La actualización ya está en cola o en curso.' }

  const queued = await admin
    .from('knowledge_sync_runs')
    .insert({
      theatre_id: tenantId,
      source_id: sourceId,
      trigger: 'manual',
      status: 'queued',
      idempotency_key: `manual:${sourceId}:${randomUUID()}`,
    })

  if (queued.error && queued.error.code !== '23505') {
    const quotaError = isManagedWebQuotaError(queued.error)
    return {
      ok: false,
      message: quotaError === 'managed_web_manual_sync_quota_exceeded'
        ? `Has alcanzado el límite diario de ${quota.limits.maxManualSyncsPerDay} actualizaciones manuales.`
        : `No se pudo solicitar la actualización: ${queued.error.message}`,
    }
  }

  await admin
    .from('knowledge_sources')
    .update({ next_sync_at: new Date().toISOString() })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  revalidatePath(`/${tenantId}/knowledge`)
  return { ok: true, message: 'Actualización añadida a la cola.' }
}

export async function requestKnowledgeSourceSupport(
  tenantId: string,
  input: { sourceId: string; idempotencyKey: string; message: string }
): Promise<SettingsFormState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const parsed = knowledgeSourceSupportSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Describe brevemente el problema antes de enviar la solicitud.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  if (!await assertTenantAdmin(admin, user.id, tenantId)) {
    return { ok: false, message: 'No tienes permisos para solicitar soporte para esta fuente.' }
  }

  const [{ data: source, error: sourceError }, { data: theatre }] = await Promise.all([
    admin
      .from('knowledge_sources')
      .select('id, name, source_url, last_sync_run_id')
      .eq('id', parsed.data.sourceId)
      .eq('theatre_id', tenantId)
      .in('type', ['url', 'sitemap', 'website'])
      .maybeSingle(),
    admin.from('theatres').select('name').eq('id', tenantId).maybeSingle(),
  ])
  if (sourceError || !source) {
    return { ok: false, message: 'Fuente web no encontrada.' }
  }

  const { data: run } = source.last_sync_run_id
    ? await admin
      .from('knowledge_sync_runs')
      .select('id, error_code')
      .eq('id', source.last_sync_run_id)
      .eq('source_id', source.id)
      .eq('theatre_id', tenantId)
      .maybeSingle()
    : { data: null }

  const inserted = await admin
    .from('knowledge_source_support_requests')
    .insert({
      theatre_id: tenantId,
      source_id: source.id,
      sync_run_id: run?.id ?? null,
      requested_by: user.id,
      idempotency_key: parsed.data.idempotencyKey,
      customer_message: parsed.data.message,
      error_code: run?.error_code ?? null,
      delivery_status: 'pending',
    })
    .select('id')
    .single()

  if (inserted.error?.code === '23505') {
    return { ok: true, message: 'La solicitud de soporte ya estaba registrada.' }
  }
  if (inserted.error || !inserted.data) {
    return { ok: false, message: 'No se pudo registrar la solicitud de soporte.' }
  }

  const delivery = await sendKnowledgeSourceSupportNotification({
    requestId: inserted.data.id,
    tenantId,
    tenantName: theatre?.name ?? tenantId,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.source_url,
    runId: run?.id ?? null,
    errorCode: run?.error_code ?? null,
    requesterEmail: user.email ?? null,
    customerMessage: parsed.data.message,
  })

  await admin
    .from('knowledge_source_support_requests')
    .update(delivery.status === 'sent'
      ? { delivery_status: 'sent', delivery_error: null, delivered_at: new Date().toISOString() }
      : { delivery_status: delivery.status, delivery_error: delivery.error })
    .eq('id', inserted.data.id)
    .eq('theatre_id', tenantId)

  revalidatePath(`/${tenantId}/knowledge`)
  return {
    ok: true,
    message: delivery.status === 'sent'
      ? 'Solicitud enviada al equipo de soporte de TALIA.'
      : 'Solicitud registrada. El equipo de TALIA podrá revisarla desde soporte.',
  }
}

export async function updateManagedWebSourceSchedule(
  tenantId: string,
  sourceId: string,
  refreshInterval: string
): Promise<SettingsFormState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  if (!isKnowledgeRefreshInterval(refreshInterval)) {
    return { ok: false, message: 'Frecuencia de actualización no válida.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  if (!await assertTenantAdmin(admin, user.id, tenantId)) {
    return { ok: false, message: 'No tienes permisos para editar esta fuente.' }
  }

  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id, type, last_synced_at')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError || !source || !isManagedWebSourceType(source.type)) {
    return { ok: false, message: 'Fuente web no encontrada.' }
  }

  const nextSync = source.last_synced_at
    ? getNextKnowledgeSyncAt(refreshInterval, new Date())?.toISOString() ?? null
    : new Date().toISOString()
  const updated = await admin
    .from('knowledge_sources')
    .update({
      refresh_interval: refreshInterval,
      next_sync_at: nextSync,
    })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  if (updated.error) {
    return { ok: false, message: `No se pudo cambiar la frecuencia: ${updated.error.message}` }
  }

  revalidatePath(`/${tenantId}/knowledge`)
  return { ok: true, message: 'Frecuencia actualizada.' }
}

export type ExcelUploadState = {
  ok: boolean
  message: string
  count?: number
  replaced?: boolean
}

export type PdfUploadState = ExcelUploadState

const MAX_SPREADSHEET_SIZE_BYTES = 5 * 1024 * 1024

export async function uploadKnowledgeExcel(
  tenantId: string,
  _previousState: ExcelUploadState,
  formData: FormData
): Promise<ExcelUploadState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, message: 'No tienes permisos.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Selecciona un archivo Excel o CSV válido.' }
  }

  if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
    return { ok: false, message: 'El archivo no puede superar los 5 MB.' }
  }

  let rows: Array<Record<string, unknown>>
  try {
    rows = await parseKnowledgeSpreadsheet(file.name, await file.arrayBuffer())
  } catch {
    return { ok: false, message: 'No se pudo leer el archivo. Comprueba que sea un Excel o CSV válido.' }
  }
  if (rows.length === 0) return { ok: false, message: 'El archivo está vacío.' }

  // Normalize and validate rows
  const items: Array<{
    theatre_id: string
    source_id: string
    question: string
    answer: string
    category: string | null
    language: string
    priority: number
    active: boolean
  }> = []

  for (const [i, raw] of rows.entries()) {
    const normalize = (key: string) =>
      String(raw[key] ?? raw[key.toLowerCase()] ?? raw[key.toUpperCase()] ?? '').trim()

    const question = normalize('question') || normalize('pregunta')
    const answer = normalize('answer') || normalize('respuesta')

    if (!question || !answer) {
      return { ok: false, message: `Fila ${i + 2}: faltan los campos "question" y "answer".` }
    }

    const category = normalize('category') || normalize('categoria') || null
    const language = normalize('language') || normalize('idioma') || 'es'
    const rawPriority = raw['priority'] ?? raw['Priority'] ?? raw['prioridad'] ?? 50
    const priority = Math.min(100, Math.max(0, Number(rawPriority) || 50))

    items.push({
      theatre_id: tenantId,
      source_id: '', // filled below
      question,
      answer,
      category: category || null,
      language,
      priority,
      active: true,
    })
  }

  // Get or create xlsx source
  const existingSource = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('type', 'xlsx')
    .maybeSingle()

  let sourceId: string
  let replaced = false

  if (existingSource.data) {
    sourceId = existingSource.data.id
    replaced = true
    await admin.from('knowledge_items').delete().eq('source_id', sourceId)
    await admin
      .from('knowledge_sources')
      .update({ status: 'ready', last_synced_at: new Date().toISOString() })
      .eq('id', sourceId)
  } else {
    const created = await admin
      .from('knowledge_sources')
      .insert({
        theatre_id: tenantId,
        type: 'xlsx',
        name: file.name,
        status: 'ready',
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (created.error || !created.data) {
      return { ok: false, message: 'No se pudo registrar la fuente.' }
    }
    sourceId = created.data.id
  }

  const { error } = await admin
    .from('knowledge_items')
    .insert(items.map((item) => ({ ...item, source_id: sourceId })))

  if (error) return { ok: false, message: `Error al guardar: ${error.message}` }

  const indexed = await reindexStructuredKnowledgeSource({
    admin,
    tenantId,
    sourceId,
    sourceType: 'xlsx',
    sourceName: file.name,
    metadata: {
      file_name: file.name,
      imported_rows: items.length,
    },
  })

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    count: items.length,
    replaced,
    message: indexed.ok
      ? (replaced
        ? `${items.length} respuestas importadas e indexadas. Las anteriores han sido reemplazadas.`
        : `${items.length} respuestas importadas e indexadas correctamente.`)
      : (replaced
        ? `${items.length} respuestas importadas. Las anteriores han sido reemplazadas. Pendiente de indexar en RAG: ${indexed.message}`
        : `${items.length} respuestas importadas. Pendiente de indexar en RAG: ${indexed.message}`),
  }
}

export async function uploadKnowledgePdf(
  tenantId: string,
  _previousState: PdfUploadState,
  formData: FormData
): Promise<PdfUploadState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, message: 'No tienes permisos.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Selecciona un PDF válido.' }
  }

  const result = await importPdfKnowledgeSource({ admin, tenantId, file })
  if (!result.ok) return result

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return result
}

export async function updateKnowledgeItem(
  tenantId: string,
  itemId: string,
  _previousState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, message: 'Sin permisos.' }

  const parsed = knowledgeItemSchema.safeParse({
    question: formData.get('question'),
    answer: formData.get('answer'),
    category: formData.get('category'),
    language: formData.get('language') || 'es',
    priority: formData.get('priority') || 50,
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const { data } = parsed
  const updated = await admin
    .from('knowledge_items')
    .update({
      question: data.question,
      answer: data.answer,
      category: data.category || null,
      language: data.language,
      priority: data.priority,
    })
    .eq('id', itemId)
    .eq('theatre_id', tenantId)
    .select('source_id')
    .maybeSingle()

  if (updated.error) return { ok: false, message: `No se pudo guardar: ${updated.error.message}` }

  const sourceId = updated.data?.source_id
  const indexed = sourceId
    ? await reindexStructuredKnowledgeSource({
      admin,
      tenantId,
      sourceId,
      sourceType: 'manual',
      sourceName: 'FAQs manuales',
    })
    : null

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    message: !indexed || indexed.ok
      ? 'FAQ actualizada e indexada.'
      : `FAQ actualizada. Pendiente de indexar en RAG: ${indexed.message}`,
  }
}

export async function deleteKnowledgeItem(
  tenantId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, error: 'Sin permisos.' }

  const { data: item, error: itemError } = await admin
    .from('knowledge_items')
    .select('source_id')
    .eq('id', itemId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (itemError) return { ok: false, error: itemError.message }

  const { error } = await admin
    .from('knowledge_items')
    .delete()
    .eq('id', itemId)
    .eq('theatre_id', tenantId)

  if (error) return { ok: false, error: error.message }

  if (item?.source_id) {
    const indexed = await reindexStructuredKnowledgeSource({
      admin,
      tenantId,
      sourceId: item.source_id,
      sourceType: 'manual',
      sourceName: 'FAQs manuales',
    })

    if (!indexed.ok) return { ok: false, error: indexed.message }
  }

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return { ok: true }
}

export async function deleteKnowledgeSource(
  tenantId: string,
  sourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, error: 'Sin permisos.' }

  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id, config')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError) return { ok: false, error: sourceError.message }
  if (!source) return { ok: false, error: 'Fuente no encontrada.' }

  const config = isRecord(source.config) ? source.config : {}
  const storageBucket = typeof config.storage_bucket === 'string' ? config.storage_bucket : null
  const storagePath = typeof config.storage_path === 'string' ? config.storage_path : null

  const itemsDelete = await admin
    .from('knowledge_items')
    .delete()
    .eq('source_id', sourceId)
    .eq('theatre_id', tenantId)

  if (itemsDelete.error) return { ok: false, error: itemsDelete.error.message }

  const { error } = await admin
    .from('knowledge_sources')
    .delete()
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  if (error) return { ok: false, error: error.message }

  if (storageBucket && storagePath) {
    const removed = await admin.storage.from(storageBucket).remove([storagePath])
    if (removed.error) {
      console.warn('[knowledge-source-delete] source deleted but storage cleanup failed', {
        tenantId,
        sourceId,
        storageBucket,
        storagePath,
        error: removed.error.message,
      })
    }
  }

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return { ok: true }
}

export async function retryKnowledgeSourceEmbeddings(
  tenantId: string,
  sourceId: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, error: 'Sin permisos.' }

  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError) return { ok: false, error: sourceError.message }
  if (!source) return { ok: false, error: 'Fuente no encontrada.' }

  const { count, error: countError } = await admin
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', sourceId)
    .eq('theatre_id', tenantId)
    .eq('active', true)
    .in('embedding_status', ['pending', 'error'])

  if (countError) return { ok: false, error: countError.message }

  const limit = Math.max(1, count ?? 100)
  const result = await embedKnowledgeSourceWithTaliaAi({
    tenantId,
    sourceId,
    limit,
    retryErrors: true,
  })

  if (!result) {
    return { ok: false, error: 'TALIA AI no está configurado para generar embeddings.' }
  }

  revalidatePath(`/${tenantId}/knowledge`)

  if (!result.ok) {
    return {
      ok: false,
      error: `No se pudieron reintentar embeddings: ${result.error ?? 'error desconocido'}`,
    }
  }

  return {
    ok: true,
    message: `Embeddings revisados: ${result.checked}. Generados: ${result.embedded}. Omitidos: ${result.skipped}. Errores: ${result.failed}.`,
  }
}

async function getOrCreateManualKnowledgeSource(admin: ReturnType<typeof createAdminClient>, tenantId: string) {
  const existing = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('type', 'manual')
    .eq('name', 'FAQs manuales')
    .maybeSingle()

  if (existing.data) return { ok: true as const, id: existing.data.id }

  const created = await admin
    .from('knowledge_sources')
    .insert({
      theatre_id: tenantId,
      type: 'manual',
      name: 'FAQs manuales',
      status: 'ready',
    })
    .select('id')
    .single()

  if (created.error || !created.data) {
    return { ok: false as const, error: `No se pudo crear la fuente manual: ${created.error?.message ?? 'error desconocido'}` }
  }

  return { ok: true as const, id: created.data.id }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
