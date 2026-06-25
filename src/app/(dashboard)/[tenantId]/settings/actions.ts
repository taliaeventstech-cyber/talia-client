'use server'

import * as XLSX from 'xlsx'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { importPdfKnowledgeSource } from '@/lib/knowledge/ingestion'
import { embedKnowledgeSourceWithTaliaAi } from '@/lib/knowledge/talia-ai-embeddings'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import { updateTenantSettings as updateTenantSettingsRecord } from '@/lib/tenants/settings'
import type { Json } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type SettingsFormState = {
  ok: boolean
  message: string
}

const settingsSchema = z.object({
  plan: z.enum(['esencial', 'profesional', 'pro']),
  initialMessage: z.string().trim().min(1, 'El mensaje inicial es obligatorio').max(300),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe estar en formato hexadecimal'),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
  fallbackEmail: z.string().trim().email('El email no es válido').optional().or(z.literal('')),
  fallbackPhone: z.string().trim().max(40).optional(),
  autoOpen: z.boolean(),
  autoOpenDelay: z.coerce.number().int().min(0).max(60),
  systemPrompt: z.string().trim().max(8000, 'El prompt no puede superar los 8000 caracteres').optional(),
})

const scrapeUrlsSchema = z.array(z.string().trim().url('Todas las URLs deben ser válidas')).max(4)

const knowledgeItemSchema = z.object({
  question: z.string().trim().min(4, 'La pregunta debe tener al menos 4 caracteres').max(500),
  answer: z.string().trim().min(4, 'La respuesta debe tener al menos 4 caracteres').max(4000),
  category: z.string().trim().max(80).optional(),
  language: z.enum(['es', 'ca', 'en']),
  priority: z.coerce.number().int().min(0).max(100),
})

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

  const parsed = settingsSchema.safeParse({
    plan: formData.get('plan'),
    initialMessage: formData.get('initial_message'),
    primaryColor: formData.get('primary_color'),
    position: formData.get('position') || 'bottom-right',
    fallbackEmail: String(formData.get('fallback_email') ?? '').trim(),
    fallbackPhone: String(formData.get('fallback_phone') ?? '').trim(),
    autoOpen: formData.get('auto_open') === 'on',
    autoOpenDelay: formData.get('auto_open_delay') ?? 3,
    systemPrompt: String(formData.get('system_prompt') ?? '').trim(),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La configuración no es válida.' }
  }

  const { data } = parsed
  const existingWidget = await getExistingWidgetConfig(admin, tenantId)
  const updated = await updateTenantSettingsRecord(admin, tenantId, {
    plan: data.plan,
    systemPrompt: data.systemPrompt,
    fallbackEmail: data.fallbackEmail,
    fallbackPhone: data.fallbackPhone,
    widgetConfig: {
      ...existingWidget,
      assistantName: 'TALIA',
      initialMessage: data.initialMessage,
      primaryColor: data.primaryColor,
      position: data.position,
      autoOpen: data.autoOpen,
      autoOpenDelay: data.autoOpenDelay,
    },
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

export async function updateScrapeUrls(
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
  if (!isAdmin) return { ok: false, message: 'No tienes permisos para editar esta configuración.' }

  const urls = ['scrape_url_1', 'scrape_url_2', 'scrape_url_3', 'scrape_url_4']
    .map((key) => String(formData.get(key) ?? '').trim())
    .filter(Boolean)

  const parsed = scrapeUrlsSchema.safeParse(urls)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Las URLs no son válidas.' }
  }

  const { error } = await admin
    .from('theatres')
    .update({ scrape_urls: parsed.data })
    .eq('id', tenantId)

  if (error) return { ok: false, message: `No se pudo guardar: ${error.message}` }

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return { ok: true, message: 'URLs guardadas correctamente.' }
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

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return { ok: true, message: 'FAQ añadida correctamente.' }
}

export type ExcelUploadState = {
  ok: boolean
  message: string
  count?: number
  replaced?: boolean
}

export type PdfUploadState = ExcelUploadState

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

  // Parse spreadsheet
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { ok: false, message: 'El archivo no contiene hojas.' }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName])
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

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    count: items.length,
    replaced,
    message: replaced
      ? `${items.length} respuestas importadas. Las anteriores han sido reemplazadas.`
      : `${items.length} respuestas importadas correctamente.`,
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
  const { error } = await admin
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

  if (error) return { ok: false, message: `No se pudo guardar: ${error.message}` }

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return { ok: true, message: 'FAQ actualizada.' }
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

  const { error } = await admin
    .from('knowledge_items')
    .delete()
    .eq('id', itemId)
    .eq('theatre_id', tenantId)

  if (error) return { ok: false, error: error.message }

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
