'use server'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFParse } from 'pdf-parse'
import * as XLSX from 'xlsx'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
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
const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024
const MAX_PDF_CHUNKS = 24
const PDF_CHUNK_SIZE = 1800
const PDF_CHUNK_OVERLAP = 220

let pdfWorkerConfigured = false

function ensurePdfWorker() {
  if (pdfWorkerConfigured) return

  const pdfWorkerPath = join(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs')
  PDFParse.setWorker(`data:text/javascript;base64,${readFileSync(pdfWorkerPath, 'base64')}`)
  pdfWorkerConfigured = true
}

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

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, message: 'El archivo debe ser un PDF.' }
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return { ok: false, message: 'El PDF no puede superar los 8 MB.' }
  }

  let text = ''
  let parser: PDFParse | null = null
  try {
    ensurePdfWorker()
    const bytes = new Uint8Array(await file.arrayBuffer())
    parser = new PDFParse({ data: bytes })
    const parsed = await parser.getText()
    text = normalizeExtractedPdfText(parsed.text)
  } catch (error) {
    console.error('[knowledge-pdf-import] failed to parse PDF', {
      tenantId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, message: getPdfParseErrorMessage(error) }
  } finally {
    await parser?.destroy()
  }

  if (text.length < 120) {
    return { ok: false, message: 'No se ha encontrado suficiente texto legible en el PDF.' }
  }

  const chunks = chunkText(text, PDF_CHUNK_SIZE, PDF_CHUNK_OVERLAP).slice(0, MAX_PDF_CHUNKS)
  if (!chunks.length) {
    return { ok: false, message: 'No se han podido generar fragmentos útiles del PDF.' }
  }

  const existingSource = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('type', 'pdf')
    .maybeSingle()

  let sourceId: string
  let replaced = false
  const now = new Date().toISOString()

  if (existingSource.data) {
    sourceId = existingSource.data.id
    replaced = true
    await admin.from('knowledge_items').delete().eq('source_id', sourceId)
    const { error } = await admin
      .from('knowledge_sources')
      .update({
        name: file.name,
        status: 'ready',
        config: {
          file_name: file.name,
          file_size: file.size,
          chunk_count: chunks.length,
          max_chunks: MAX_PDF_CHUNKS,
        },
        last_error: null,
        last_synced_at: now,
      })
      .eq('id', sourceId)

    if (error) return { ok: false, message: `No se pudo actualizar la fuente PDF: ${error.message}` }
  } else {
    const created = await admin
      .from('knowledge_sources')
      .insert({
        theatre_id: tenantId,
        type: 'pdf',
        name: file.name,
        status: 'ready',
        config: {
          file_name: file.name,
          file_size: file.size,
          chunk_count: chunks.length,
          max_chunks: MAX_PDF_CHUNKS,
        },
        last_synced_at: now,
      })
      .select('id')
      .single()

    if (created.error || !created.data) {
      return { ok: false, message: `No se pudo registrar el PDF: ${created.error?.message ?? 'error desconocido'}` }
    }
    sourceId = created.data.id
  }

  const { error } = await admin
    .from('knowledge_items')
    .insert(chunks.map((chunk, index) => ({
      theatre_id: tenantId,
      source_id: sourceId,
      question: `PDF ${file.name} · fragmento ${index + 1}`,
      answer: chunk,
      category: 'documento',
      language: 'es',
      priority: 35,
      active: true,
      metadata: {
        source_type: 'pdf',
        file_name: file.name,
        chunk_index: index,
        chunk_count: chunks.length,
      },
    })))

  if (error) return { ok: false, message: `Error al guardar fragmentos del PDF: ${error.message}` }

  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)
  return {
    ok: true,
    count: chunks.length,
    replaced,
    message: replaced
      ? `${chunks.length} fragmentos importados. El PDF anterior ha sido reemplazado.`
      : `${chunks.length} fragmentos del PDF importados correctamente.`,
  }
}

function normalizeExtractedPdfText(value: string) {
  return value
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getPdfParseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  if (message.includes('password') || message.includes('encrypted')) {
    return 'No se pudo leer el PDF porque parece estar protegido o cifrado. Sube una versión sin contraseña.'
  }

  if (message.includes('invalid') || message.includes('malformed') || message.includes('corrupt')) {
    return 'No se pudo leer el PDF porque el archivo parece estar dañado o no es un PDF válido.'
  }

  return 'No se pudo procesar el PDF. Revisa los logs del servidor para ver el detalle técnico.'
}

function chunkText(value: string, size: number, overlap: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const hardEnd = Math.min(normalized.length, start + size)
    const nextBoundary = normalized.lastIndexOf('. ', hardEnd)
    const end = nextBoundary > start + Math.floor(size * 0.55) ? nextBoundary + 1 : hardEnd
    const chunk = normalized.slice(start, end).trim()
    if (chunk.length > 80) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(0, end - overlap)
  }

  return chunks
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
