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

const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024
const KNOWLEDGE_FILES_BUCKET = process.env.KNOWLEDGE_FILES_BUCKET || 'knowledge-files'

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

async function markPdfSourceError(admin: AdminClient, sourceId: string, message: string) {
  await admin
    .from('knowledge_sources')
    .update({
      status: 'error',
      last_error: message,
    })
    .eq('id', sourceId)
}

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
