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

const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024
const KNOWLEDGE_FILES_BUCKET = process.env.KNOWLEDGE_FILES_BUCKET || 'knowledge-files'

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

export async function syncUrlKnowledgeSources({
  admin,
  tenantId,
  urls,
}: {
  admin: AdminClient
  tenantId: string
  urls: string[]
}): Promise<KnowledgeImportResult> {
  const uniqueUrls = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)))

  const { data: existingSources, error: existingError } = await admin
    .from('knowledge_sources')
    .select('id, source_url')
    .eq('theatre_id', tenantId)
    .eq('type', 'url')

  if (existingError) {
    return { ok: false, message: `No se pudieron leer las fuentes URL: ${existingError.message}` }
  }

  const removedSources = (existingSources ?? []).filter((source) => !source.source_url || !uniqueUrls.includes(source.source_url))
  for (const source of removedSources) {
    const removed = await admin
      .from('knowledge_sources')
      .delete()
      .eq('id', source.id)
      .eq('theatre_id', tenantId)
      .eq('type', 'url')

    if (removed.error) {
      return { ok: false, message: `No se pudo eliminar una fuente URL obsoleta: ${removed.error.message}` }
    }
  }

  let indexed = 0
  let chunks = 0
  const failures: string[] = []

  for (const url of uniqueUrls) {
    const source = await upsertUrlSource({ admin, tenantId, url })
    if (!source.ok) {
      failures.push(source.message)
      continue
    }

    const ingested = await ingestUrlKnowledgeSource({
      admin,
      tenantId,
      sourceId: source.sourceId,
      url,
    })

    if (ingested.ok) {
      indexed += 1
      chunks += ingested.count ?? 0
    } else {
      failures.push(`${url}: ${ingested.message}`)
    }
  }

  if (failures.length) {
    return {
      ok: false,
      count: chunks,
      message: `${indexed}/${uniqueUrls.length} URLs indexadas. Errores: ${failures.join(' · ')}`,
    }
  }

  return {
    ok: true,
    count: chunks,
    message: uniqueUrls.length
      ? `${uniqueUrls.length} URLs indexadas en ${chunks} fragmentos RAG.`
      : 'URLs limpiadas correctamente.',
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

async function upsertUrlSource({
  admin,
  tenantId,
  url,
}: {
  admin: AdminClient
  tenantId: string
  url: string
}): Promise<KnowledgeImportResult & { sourceId: string }> {
  const existing = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('type', 'url')
    .eq('source_url', url)
    .maybeSingle()

  const config = {
    source_url: url,
  }
  const name = getUrlSourceName(url)

  if (existing.error) {
    return { ok: false, message: `No se pudo leer la fuente URL: ${existing.error.message}`, sourceId: '' }
  }

  if (existing.data) {
    const { error } = await admin
      .from('knowledge_sources')
      .update({
        name,
        source_url: url,
        status: 'processing',
        config,
        last_error: null,
      })
      .eq('id', existing.data.id)
      .eq('theatre_id', tenantId)

    if (error) return { ok: false, message: `No se pudo actualizar la fuente URL: ${error.message}`, sourceId: '' }
    return { ok: true, message: '', sourceId: existing.data.id, replaced: true }
  }

  const created = await admin
    .from('knowledge_sources')
    .insert({
      theatre_id: tenantId,
      type: 'url',
      name,
      source_url: url,
      status: 'processing',
      config,
    })
    .select('id')
    .single()

  if (created.error || !created.data) {
    return {
      ok: false,
      message: `No se pudo crear la fuente URL: ${created.error?.message ?? 'error desconocido'}`,
      sourceId: '',
    }
  }

  return { ok: true, message: '', sourceId: created.data.id, replaced: false }
}

async function ingestUrlKnowledgeSource({
  admin,
  tenantId,
  sourceId,
  url,
}: {
  admin: AdminClient
  tenantId: string
  sourceId: string
  url: string
}): Promise<KnowledgeImportResult> {
  const ingest = await ingestKnowledgeTextWithTaliaAi({
    tenantId,
    sourceId,
    sourceType: 'url',
    url,
    metadata: {
      source_type: 'url',
      source_url: url,
      language: 'es',
      indexed_at: new Date().toISOString(),
    },
  })

  if (!ingest) {
    await markKnowledgeSourceError(admin, sourceId, 'TALIA AI no está configurado para ingestar URLs.')
    return { ok: false, message: 'TALIA AI no está configurado para ingestar URLs.' }
  }

  if (!ingest.ok) {
    await markKnowledgeSourceError(admin, sourceId, ingest.error ?? 'No se pudo ingestar la URL.')
    return { ok: false, message: `No se pudo ingestar la URL: ${ingest.error ?? 'error desconocido'}` }
  }

  await embedInsertedChunks({
    tenantId,
    sourceId,
    limit: ingest.chunks,
  })

  return {
    ok: true,
    count: ingest.chunks,
    message: `${ingest.chunks} fragmentos de URL importados correctamente.`,
  }
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

function getUrlSourceName(value: string) {
  try {
    const url = new URL(value)
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`.slice(0, 120)
  } catch {
    return value.slice(0, 120)
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
