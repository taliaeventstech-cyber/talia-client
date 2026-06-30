import { embedKnowledgeSourceWithTaliaAi } from './talia-ai-embeddings'
import { ingestKnowledgeTextWithTaliaAi } from './talia-ai-ingestion'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

type UploadedKnowledgeFile = {
  name: string
  size: number
  type: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

export type KnowledgeImportResult = {
  ok: boolean
  message: string
  count?: number
  replaced?: boolean
}

export type StructuredKnowledgeItem = {
  id?: string
  question: string
  answer: string
  category: string | null
  language: string
  priority: number
}

export type TenantKnowledgeReindexResult = {
  ok: boolean
  checked: number
  reindexed: number
  failed: number
  chunks: number
  message: string
  errors: string[]
}

const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024
const KNOWLEDGE_FILES_BUCKET = process.env.KNOWLEDGE_FILES_BUCKET || 'knowledge-files'

export async function reindexTenantKnowledgeSources({
  admin,
  tenantId,
}: {
  admin: AdminClient
  tenantId: string
}): Promise<TenantKnowledgeReindexResult> {
  const errors: string[] = []
  let checked = 0
  let reindexed = 0
  let chunks = 0

  const orphanResult = await attachOrphanKnowledgeItemsToManualSource({ admin, tenantId })
  if (!orphanResult.ok) errors.push(orphanResult.message)

  const { data: sources, error: sourcesError } = await admin
    .from('knowledge_sources')
    .select('id, type, name')
    .eq('theatre_id', tenantId)
    .order('created_at', { ascending: true })

  if (sourcesError) {
    return {
      ok: false,
      checked: 0,
      reindexed: 0,
      failed: 1,
      chunks: 0,
      errors: [sourcesError.message],
      message: `No se pudieron leer las fuentes: ${sourcesError.message}`,
    }
  }

  for (const source of sources ?? []) {
    if (source.type === 'url' || source.type === 'web_snapshot') continue

    checked += 1
    let result: KnowledgeImportResult

    if (source.type === 'pdf') {
      result = await reprocessStoredKnowledgeSource({ admin, tenantId, sourceId: source.id })
    } else if (source.type === 'manual' || source.type === 'xlsx' || source.type === 'csv') {
      result = await reindexStructuredKnowledgeSource({
        admin,
        tenantId,
        sourceId: source.id,
        sourceType: source.type,
        sourceName: source.name,
      })
    } else {
      continue
    }

    if (result.ok) {
      reindexed += 1
      chunks += result.count ?? 0
    } else {
      errors.push(`${source.name}: ${result.message}`)
    }
  }

  const failed = errors.length

  return {
    ok: failed === 0,
    checked,
    reindexed,
    failed,
    chunks,
    errors,
    message: failed === 0
      ? `Reindexado completo: ${reindexed}/${checked} fuentes, ${chunks} fragmentos.`
      : `Reindexado parcial: ${reindexed}/${checked} fuentes, ${chunks} fragmentos. Errores: ${errors.join(' · ')}`,
  }
}

export async function reindexStructuredKnowledgeSource({
  admin,
  tenantId,
  sourceId,
  sourceType,
  sourceName,
  metadata = {},
}: {
  admin: AdminClient
  tenantId: string
  sourceId: string
  sourceType: 'manual' | 'xlsx' | 'csv'
  sourceName: string
  metadata?: Record<string, unknown>
}): Promise<KnowledgeImportResult> {
  const { data: items, error } = await admin
    .from('knowledge_items')
    .select('id, question, answer, category, language, priority')
    .eq('theatre_id', tenantId)
    .eq('source_id', sourceId)
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    return { ok: false, message: `No se pudieron leer las respuestas para indexar: ${error.message}` }
  }

  if (!items?.length) {
    const cleared = await clearKnowledgeSourceChunks({
      admin,
      tenantId,
      sourceId,
      sourceType,
      sourceName,
      metadata,
    })
    return cleared
  }

  await admin
    .from('knowledge_sources')
    .update({
      status: 'processing',
      last_error: null,
    })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  const indexedAt = new Date().toISOString()
  const text = renderStructuredKnowledgeText({
    sourceName,
    sourceType,
    items,
  })

  const ingest = await ingestKnowledgeTextWithTaliaAi({
    tenantId,
    sourceId,
    sourceType,
    text,
    metadata: {
      ...metadata,
      source_type: sourceType,
      source_name: sourceName,
      item_count: items.length,
      language: getDominantLanguage(items),
      indexed_at: indexedAt,
    },
  })

  if (!ingest) {
    await markKnowledgeSourceError(admin, sourceId, 'TALIA AI no está configurado para indexar esta fuente.')
    return { ok: false, message: 'TALIA AI no está configurado para indexar esta fuente.' }
  }

  if (!ingest.ok) {
    await markKnowledgeSourceError(admin, sourceId, ingest.error ?? 'No se pudo indexar esta fuente.')
    return { ok: false, message: `No se pudo indexar esta fuente: ${ingest.error ?? 'error desconocido'}` }
  }

  await embedInsertedChunks({
    tenantId,
    sourceId,
    limit: ingest.chunks,
  })

  return {
    ok: true,
    count: ingest.chunks,
    message: `${items.length} respuestas indexadas en ${ingest.chunks} fragmentos RAG.`,
  }
}

export async function registerInstalledWebPage({
  admin,
  tenantId,
  url,
  title,
}: {
  admin: AdminClient
  tenantId: string
  url: string
  title?: string | null
}): Promise<KnowledgeImportResult & { sourceId?: string }> {
  const normalizedUrl = normalizeSourceUrl(url)
  if (!normalizedUrl) return { ok: false, message: 'URL no válida.' }

  const name = title?.trim() || getPageSourceName(normalizedUrl)
  const config = {
    capture_url: normalizedUrl,
    page_title: title?.trim() || null,
    registered_at: new Date().toISOString(),
  }

  const existing = await admin
    .from('knowledge_sources')
    .select('id, status, config')
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')
    .eq('source_url', normalizedUrl)
    .maybeSingle()

  if (existing.error) return { ok: false, message: existing.error.message }

  if (existing.data) {
    const existingConfig = isRecord(existing.data.config) ? existing.data.config : {}
    const update = await admin
      .from('knowledge_sources')
      .update({
        name,
        source_url: normalizedUrl,
        status: existing.data.status === 'ready' ? 'ready' : 'connected',
        last_error: null,
        config: {
          ...existingConfig,
          ...config,
          last_seen_at: new Date().toISOString(),
        },
      })
      .eq('id', existing.data.id)
      .eq('theatre_id', tenantId)

    if (update.error) return { ok: false, message: update.error.message }
    return { ok: true, message: 'Página instalada actualizada.', sourceId: existing.data.id }
  }

  const created = await admin
    .from('knowledge_sources')
    .insert({
      theatre_id: tenantId,
      type: 'web_snapshot',
      name,
      source_url: normalizedUrl,
      status: 'connected',
      config,
    })
    .select('id')
    .single()

  if (created.error || !created.data) {
    return { ok: false, message: created.error?.message ?? 'No se pudo registrar la página instalada.' }
  }

  return { ok: true, message: 'Página instalada registrada.', sourceId: created.data.id }
}

export async function ingestWebSnapshotSource({
  admin,
  tenantId,
  sourceId,
  url,
  title,
  text,
}: {
  admin: AdminClient
  tenantId: string
  sourceId: string
  url: string
  title?: string | null
  text: string
}): Promise<KnowledgeImportResult> {
  const normalizedUrl = normalizeSourceUrl(url)
  if (!normalizedUrl) return { ok: false, message: 'URL no válida.' }

  const cleanText = text.trim()
  if (cleanText.length < 40) {
    await markKnowledgeSourceError(admin, sourceId, 'La página no contiene texto suficiente para indexar.')
    return { ok: false, message: 'La página no contiene texto suficiente para indexar.' }
  }

  const { data: existingSource } = await admin
    .from('knowledge_sources')
    .select('config')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')
    .maybeSingle()
  const existingConfig = isRecord(existingSource?.config) ? existingSource.config : {}
  const captureStartedAt = new Date().toISOString()

  const sourceUpdate = await admin
    .from('knowledge_sources')
    .update({
      name: title?.trim() || getPageSourceName(normalizedUrl),
      source_url: normalizedUrl,
      status: 'processing',
      last_error: null,
      config: {
        ...existingConfig,
        capture_url: normalizedUrl,
        page_title: title?.trim() || null,
        source_type: 'web_snapshot',
        capture_started_at: captureStartedAt,
      },
    })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')

  if (sourceUpdate.error) {
    return { ok: false, message: `No se pudo preparar la captura: ${sourceUpdate.error.message}` }
  }

  const ingest = await ingestKnowledgeTextWithTaliaAi({
    tenantId,
    sourceId,
    sourceType: 'web_snapshot',
    text: cleanText,
    metadata: {
      source_type: 'web_snapshot',
      source_url: normalizedUrl,
      page_title: title?.trim() || null,
      capture_method: 'installed_widget',
      language: 'es',
      indexed_at: new Date().toISOString(),
    },
  })

  if (!ingest) {
    await markKnowledgeSourceError(admin, sourceId, 'TALIA AI no está configurado para ingestar capturas web.')
    return { ok: false, message: 'TALIA AI no está configurado para ingestar capturas web.' }
  }

  if (!ingest.ok) {
    await markKnowledgeSourceError(admin, sourceId, ingest.error ?? 'No se pudo ingestar la captura web.')
    return { ok: false, message: `No se pudo ingestar la captura web: ${ingest.error ?? 'error desconocido'}` }
  }

  await embedInsertedChunks({
    tenantId,
    sourceId,
    limit: ingest.chunks,
  })

  const captureCompletedAt = new Date().toISOString()
  await admin
    .from('knowledge_sources')
    .update({
      status: 'ready',
      last_error: null,
      last_synced_at: captureCompletedAt,
      config: {
        ...existingConfig,
        capture_url: normalizedUrl,
        page_title: title?.trim() || null,
        source_type: 'web_snapshot',
        capture_started_at: captureStartedAt,
        capture_completed_at: captureCompletedAt,
        chunk_count: ingest.chunks,
      },
    })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .eq('type', 'web_snapshot')

  return {
    ok: true,
    count: ingest.chunks,
    message: 'Captura web preparada para TALIA.',
  }
}

export async function importPdfKnowledgeSource({
  admin,
  tenantId,
  file,
}: {
  admin: AdminClient
  tenantId: string
  file: UploadedKnowledgeFile
}): Promise<KnowledgeImportResult> {
  const validationError = validatePdfFile(file)
  if (validationError) return { ok: false, message: validationError }

  const source = await upsertPdfSource({ admin, tenantId, file })
  if (!source.ok) return source

  const storage = await uploadPdfToStorage({ admin, tenantId, sourceId: source.sourceId, file })
  if (!storage.ok) {
    await markPdfSourceError(admin, source.sourceId, storage.message)
    return { ok: false, message: storage.message }
  }
  await admin
    .from('knowledge_sources')
    .update({
      config: {
        file_name: file.name,
        file_size: file.size,
        storage_bucket: storage.bucket,
        storage_path: storage.path,
      },
    })
    .eq('id', source.sourceId)

  const ingest = await ingestKnowledgeTextWithTaliaAi({
    tenantId,
    sourceId: source.sourceId,
    sourceType: 'pdf',
    metadata: {
      source_type: 'pdf',
      file_name: file.name,
      file_size: file.size,
      language: 'es',
      storage_bucket: storage.bucket,
      storage_path: storage.path,
    },
    storage: {
      bucket: storage.bucket,
      path: storage.path,
    },
  })

  if (!ingest) {
    await markPdfSourceError(admin, source.sourceId, 'TALIA AI no está configurado para ingestar PDFs.')
    return { ok: false, message: 'TALIA AI no está configurado para ingestar PDFs.' }
  }
  if (!ingest.ok) {
    await markPdfSourceError(admin, source.sourceId, ingest.error ?? 'No se pudo ingestar el PDF.')
    return { ok: false, message: `No se pudo ingestar el PDF: ${ingest.error ?? 'error desconocido'}` }
  }

  await embedInsertedChunks({
    tenantId,
    sourceId: source.sourceId,
    limit: ingest.chunks,
  })

  return {
    ok: true,
    count: ingest.chunks,
    replaced: source.replaced,
    message: source.replaced
      ? `${ingest.chunks} fragmentos importados. El PDF anterior ha sido reemplazado.`
      : `${ingest.chunks} fragmentos del PDF importados correctamente.`,
  }
}

async function attachOrphanKnowledgeItemsToManualSource({
  admin,
  tenantId,
}: {
  admin: AdminClient
  tenantId: string
}): Promise<KnowledgeImportResult> {
  const { count, error: countError } = await admin
    .from('knowledge_items')
    .select('id', { count: 'exact', head: true })
    .eq('theatre_id', tenantId)
    .is('source_id', null)

  if (countError) return { ok: false, message: countError.message }
  if (!count) return { ok: true, count: 0, message: 'Sin FAQs huérfanas.' }

  const source = await getOrCreateManualKnowledgeSource({ admin, tenantId })
  if (!source.ok) return source

  const updated = await admin
    .from('knowledge_items')
    .update({ source_id: source.sourceId })
    .eq('theatre_id', tenantId)
    .is('source_id', null)

  if (updated.error) {
    return { ok: false, message: `No se pudieron asociar FAQs huérfanas: ${updated.error.message}` }
  }

  return { ok: true, count, message: `${count} FAQs huérfanas asociadas a la fuente manual.` }
}

async function getOrCreateManualKnowledgeSource({
  admin,
  tenantId,
}: {
  admin: AdminClient
  tenantId: string
}): Promise<KnowledgeImportResult & { sourceId: string }> {
  const existing = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('type', 'manual')
    .eq('name', 'FAQs manuales')
    .maybeSingle()

  if (existing.error) {
    return { ok: false, message: `No se pudo leer la fuente manual: ${existing.error.message}`, sourceId: '' }
  }

  if (existing.data) return { ok: true, message: '', sourceId: existing.data.id }

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
    return {
      ok: false,
      message: `No se pudo crear la fuente manual: ${created.error?.message ?? 'error desconocido'}`,
      sourceId: '',
    }
  }

  return { ok: true, message: '', sourceId: created.data.id }
}

export async function reprocessStoredKnowledgeSource({
  admin,
  tenantId,
  sourceId,
}: {
  admin: AdminClient
  tenantId: string
  sourceId: string
}): Promise<KnowledgeImportResult> {
  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id, type, name, config')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError) return { ok: false, message: sourceError.message }
  if (!source) return { ok: false, message: 'Fuente no encontrada.' }
  if (source.type !== 'pdf') return { ok: false, message: 'Solo se pueden reprocesar PDFs desde Storage.' }

  const config = isRecord(source.config) ? source.config : {}
  const storageBucket = typeof config.storage_bucket === 'string' ? config.storage_bucket : null
  const storagePath = typeof config.storage_path === 'string' ? config.storage_path : null
  const fileName = typeof config.file_name === 'string' ? config.file_name : source.name
  const fileSize = typeof config.file_size === 'number' ? config.file_size : null

  if (!storageBucket || !storagePath) {
    return {
      ok: false,
      message: 'Esta fuente no tiene archivo en Storage. Sube el PDF de nuevo para poder reprocesarlo.',
    }
  }

  await admin
    .from('knowledge_sources')
    .update({
      status: 'processing',
      last_error: null,
    })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  const ingest = await ingestKnowledgeTextWithTaliaAi({
    tenantId,
    sourceId,
    sourceType: 'pdf',
    metadata: {
      source_type: 'pdf',
      file_name: fileName,
      ...(fileSize !== null ? { file_size: fileSize } : {}),
      language: 'es',
      storage_bucket: storageBucket,
      storage_path: storagePath,
      reprocessed_at: new Date().toISOString(),
    },
    storage: {
      bucket: storageBucket,
      path: storagePath,
    },
  })

  if (!ingest) {
    await markPdfSourceError(admin, sourceId, 'TALIA AI no está configurado para reprocesar fuentes.')
    return { ok: false, message: 'TALIA AI no está configurado para reprocesar fuentes.' }
  }

  if (!ingest.ok) {
    await markPdfSourceError(admin, sourceId, ingest.error ?? 'No se pudo reprocesar la fuente.')
    return { ok: false, message: `No se pudo reprocesar la fuente: ${ingest.error ?? 'error desconocido'}` }
  }

  await embedInsertedChunks({
    tenantId,
    sourceId,
    limit: ingest.chunks,
  })

  return {
    ok: true,
    count: ingest.chunks,
    replaced: true,
    message: `${ingest.chunks} fragmentos regenerados desde el PDF guardado.`,
  }
}

function validatePdfFile(file: UploadedKnowledgeFile) {
  if (file.size === 0) return 'Selecciona un PDF válido.'

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'El archivo debe ser un PDF.'
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return 'El PDF no puede superar los 8 MB.'
  }

  return null
}

async function upsertPdfSource({
  admin,
  tenantId,
  file,
}: {
  admin: AdminClient
  tenantId: string
  file: UploadedKnowledgeFile
}): Promise<KnowledgeImportResult & { sourceId: string }> {
  const existingSource = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('type', 'pdf')
    .maybeSingle()

  const config = {
    file_name: file.name,
    file_size: file.size,
  }

  if (existingSource.data) {
    const sourceId = existingSource.data.id
    await admin.from('knowledge_items').delete().eq('source_id', sourceId)
    const { error } = await admin
      .from('knowledge_sources')
      .update({
        name: file.name,
        status: 'processing',
        config,
        last_error: null,
      })
      .eq('id', sourceId)

    if (error) {
      return {
        ok: false,
        message: `No se pudo actualizar la fuente PDF: ${error.message}`,
        sourceId: '',
      }
    }

    return { ok: true, message: '', sourceId, replaced: true }
  }

  const created = await admin
    .from('knowledge_sources')
    .insert({
      theatre_id: tenantId,
      type: 'pdf',
      name: file.name,
      status: 'processing',
      config,
    })
    .select('id')
    .single()

  if (created.error || !created.data) {
    return {
      ok: false,
      message: `No se pudo registrar el PDF: ${created.error?.message ?? 'error desconocido'}`,
      sourceId: '',
    }
  }

  return { ok: true, message: '', sourceId: created.data.id, replaced: false }
}

async function clearKnowledgeSourceChunks({
  admin,
  tenantId,
  sourceId,
  sourceType,
  sourceName,
  metadata,
}: {
  admin: AdminClient
  tenantId: string
  sourceId: string
  sourceType: string
  sourceName: string
  metadata: Record<string, unknown>
}): Promise<KnowledgeImportResult> {
  const chunksDelete = await admin
    .from('knowledge_chunks')
    .delete()
    .eq('theatre_id', tenantId)
    .eq('source_id', sourceId)

  if (chunksDelete.error) {
    return { ok: false, message: `No se pudieron limpiar fragmentos antiguos: ${chunksDelete.error.message}` }
  }

  const sourceUpdate = await admin
    .from('knowledge_sources')
    .update({
      status: 'ready',
      last_error: null,
      last_synced_at: new Date().toISOString(),
      config: {
        ...metadata,
        source_type: sourceType,
        source_name: sourceName,
        item_count: 0,
        chunk_count: 0,
      },
    })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  if (sourceUpdate.error) {
    return { ok: false, message: `No se pudo actualizar la fuente: ${sourceUpdate.error.message}` }
  }

  return { ok: true, count: 0, message: 'Fuente limpiada: no quedan respuestas activas para indexar.' }
}

function renderStructuredKnowledgeText({
  sourceName,
  sourceType,
  items,
}: {
  sourceName: string
  sourceType: string
  items: StructuredKnowledgeItem[]
}) {
  const header = [
    `Fuente: ${sourceName}`,
    `Tipo: ${sourceType}`,
    'Formato: respuestas oficiales estructuradas para TALIA.',
  ].join('\n')

  const body = items.map((item, index) => {
    const lines = [
      `Entrada ${index + 1}`,
      `Pregunta del visitante: ${item.question}`,
      `Respuesta oficial: ${item.answer}`,
      `Idioma: ${item.language}`,
      `Confianza: ${item.priority}`,
    ]

    if (item.category) lines.push(`Tema: ${item.category}`)

    return lines.join('\n')
  }).join('\n\n---\n\n')

  return `${header}\n\n${body}`
}

function getDominantLanguage(items: StructuredKnowledgeItem[]) {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item.language, (counts.get(item.language) ?? 0) + 1)
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'es'
}

function getPageSourceName(value: string) {
  try {
    const url = new URL(value)
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`.slice(0, 120)
  } catch {
    return value.slice(0, 120)
  }
}

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

async function uploadPdfToStorage({
  admin,
  tenantId,
  sourceId,
  file,
}: {
  admin: AdminClient
  tenantId: string
  sourceId: string
  file: UploadedKnowledgeFile
}): Promise<{ ok: true; bucket: string; path: string } | { ok: false; message: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const path = `${tenantId}/${sourceId}/${Date.now()}-${sanitizeFileName(file.name)}`
  const upload = await admin.storage.from(KNOWLEDGE_FILES_BUCKET).upload(path, bytes, {
    contentType: file.type || 'application/pdf',
    upsert: false,
  })

  if (upload.error) {
    return { ok: false, message: `No se pudo subir el PDF a Storage: ${upload.error.message}` }
  }

  return { ok: true, bucket: KNOWLEDGE_FILES_BUCKET, path }
}

async function embedInsertedChunks({
  tenantId,
  sourceId,
  limit,
}: {
  tenantId: string
  sourceId: string
  limit: number
}) {
  if (limit <= 0) return

  const remoteResult = await embedKnowledgeSourceWithTaliaAi({
    tenantId,
    sourceId,
    limit,
  })

  if (remoteResult?.ok) return

  if (remoteResult && !remoteResult.ok) {
    console.error('[knowledge-pdf-import] talia-ai failed to embed PDF chunks; chunks remain pending', {
      tenantId,
      sourceId,
      checked: remoteResult.checked,
      failed: remoteResult.failed,
      error: remoteResult.error,
    })
  }
}

async function markKnowledgeSourceError(admin: AdminClient, sourceId: string, message: string) {
  await admin
    .from('knowledge_sources')
    .update({
      status: 'error',
      last_error: message,
    })
    .eq('id', sourceId)
}

const markPdfSourceError = markKnowledgeSourceError

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'source.pdf'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
