'use server'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { reindexStructuredKnowledgeSource, reindexTenantKnowledgeSources, reprocessStoredKnowledgeSource } from '@/lib/knowledge/ingestion'
import { embedKnowledgeSourceWithTaliaAi } from '@/lib/knowledge/talia-ai-embeddings'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { isManagedWebSourceType } from '@/lib/knowledge/managed-web-sources'
import { deleteKnowledgeSourceData } from '@/lib/knowledge/source-deletion'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { consumeRateLimit } from '@/lib/auth/security'
import { analyzeDiagnosticWithTaliaAi } from '@/lib/diagnostics/talia-ai'
import { buildResponseDiagnosticArtifact } from '@/lib/diagnostics/artifacts'
import { buildKnowledgeSourceDebugPayload } from '@/lib/knowledge/source-debug'
import type { DiagnosticAnalysis, DiagnosticArtifactType } from '@/lib/diagnostics/report'
import { recordDiagnosticUsage } from '@/lib/diagnostics/usage'
import { withProgrammeExtractionEnabled } from '@/lib/knowledge/programme'

const diagnosticActionSchema = z.object({
  tenantId: z.string().uuid(),
  artifactType: z.enum(['response_trace', 'knowledge_source']),
  artifactId: z.string().uuid(),
})

export type BackstageDiagnosticActionResult =
  | { ok: true; analysis: DiagnosticAnalysis }
  | { ok: false; message: string }

export async function analyzeBackstageDiagnostic(
  tenantId: string,
  artifactType: DiagnosticArtifactType,
  artifactId: string,
): Promise<BackstageDiagnosticActionResult> {
  const platformAccess = await requirePlatformAdmin()
  const parsed = diagnosticActionSchema.safeParse({ tenantId, artifactType, artifactId })
  if (!parsed.success) return { ok: false, message: 'La referencia del diagnóstico no es válida.' }

  const limited = await consumeRateLimit([
    { key: `backstage-diagnostics-user:${platformAccess.user.id}`, limit: 30, windowMs: 60 * 60 * 1_000 },
    { key: `backstage-diagnostics-artifact:${platformAccess.user.id}:${artifactId}`, limit: 5, windowMs: 5 * 60 * 1_000 },
  ])
  if (limited) {
    return {
      ok: false,
      message: limited.unavailable
        ? 'El control de uso no está disponible. El análisis se ha detenido de forma segura.'
        : `Has alcanzado el límite temporal de diagnósticos. Reinténtalo en ${limited.retryAfterSeconds} segundos.`,
    }
  }

  const admin = createAdminClient()
  const { data: venue, error: venueError } = await admin
    .from('theatres')
    .select('id, account_id, name')
    .eq('id', tenantId)
    .maybeSingle()
  if (venueError || !venue) return { ok: false, message: 'No se pudo comprobar el venue del diagnóstico.' }

  const artifact = artifactType === 'response_trace'
    ? await loadResponseDiagnosticArtifact(admin, tenantId, artifactId)
    : await loadKnowledgeSourceDiagnosticArtifact(admin, tenantId, artifactId)
  if (!artifact.ok) return artifact

  const diagnosticRunId = randomUUID()
  const result = await analyzeDiagnosticWithTaliaAi({
    tenantId,
    artifactType,
    artifactId,
    artifact: artifact.value,
  })
  if (!result.ok) return { ok: false, message: result.error }

  await recordDiagnosticUsage(admin, {
    tenantId,
    artifactType,
    artifactId,
    diagnosticRunId,
    analysis: result.analysis,
  })

  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: venue.account_id,
    theatre_id: tenantId,
    actor_user_id: platformAccess.user.id,
    action: 'backstage.ai_diagnostic_generated',
    target_type: artifactType,
    target_id: artifactId,
    metadata: {
      schema_version: result.analysis.report.schema_version,
      classification: result.analysis.report.classification,
      confidence: result.analysis.report.confidence,
      provider: result.analysis.provider,
      model: result.analysis.model,
    },
  })
  if (auditError) {
    console.error('[backstage-diagnostics] failed to record audit event', {
      tenantId,
      artifactType,
      artifactId,
      code: auditError.code,
    })
  }

  return { ok: true, analysis: result.analysis }
}

async function loadResponseDiagnosticArtifact(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  messageId: string,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; message: string }> {
  const { data: message, error } = await admin
    .from('messages')
    .select('id, conversation_id, content, created_at, metadata')
    .eq('id', messageId)
    .eq('theatre_id', tenantId)
    .eq('role', 'assistant')
    .maybeSingle()
  if (error) return { ok: false, message: 'No se pudo cargar la traza de respuesta.' }
  if (!message) return { ok: false, message: 'La respuesta ya no existe o no pertenece a este venue.' }

  const { data: conversation } = await admin
    .from('conversations')
    .select('metadata')
    .eq('id', message.conversation_id)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  return {
    ok: true,
    value: buildResponseDiagnosticArtifact({
      content: message.content,
      createdAt: message.created_at,
      metadata: message.metadata,
      conversationMetadata: conversation?.metadata,
    }),
  }
}

async function loadKnowledgeSourceDiagnosticArtifact(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  sourceId: string,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; message: string }> {
  const [sourceResult, runResult, chunksResult, documentsResult] = await Promise.all([
    admin
      .from('knowledge_sources')
      .select('id, type, name, status, sync_enabled, source_url, refresh_interval, next_sync_at, last_synced_at, last_error')
      .eq('id', sourceId)
      .eq('theatre_id', tenantId)
      .maybeSingle(),
    admin
      .from('knowledge_sync_runs')
      .select('status, discovered_count, checked_count, changed_count, unchanged_count, failed_count, blocked_count, error_code, error_details, metadata, created_at, finished_at')
      .eq('source_id', sourceId)
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('knowledge_chunks')
      .select('embedding_status, active')
      .eq('source_id', sourceId)
      .eq('theatre_id', tenantId),
    admin
      .from('knowledge_documents')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('theatre_id', tenantId)
      .neq('status', 'removed'),
  ])
  const { data: source, error } = sourceResult
  const { data: run, error: runError } = runResult
  const { data: chunks, error: chunksError } = chunksResult
  if (error || runError || chunksError || documentsResult.error) {
    return { ok: false, message: 'No se pudo cargar el diagnóstico completo de la fuente.' }
  }
  if (!source) return { ok: false, message: 'La fuente ya no existe o no pertenece a este venue.' }

  const activeChunks = (chunks ?? []).filter((chunk) => chunk.active)
  const embeddingCounts = {
    ready: activeChunks.filter((chunk) => chunk.embedding_status === 'ready').length,
    pending: activeChunks.filter((chunk) => chunk.embedding_status === 'pending').length,
    processing: activeChunks.filter((chunk) => chunk.embedding_status === 'processing').length,
    error: activeChunks.filter((chunk) => chunk.embedding_status === 'error').length,
  }
  const payload = buildKnowledgeSourceDebugPayload({
    id: source.id,
    type: source.type,
    name: source.name,
    status: source.status,
    syncEnabled: source.sync_enabled,
    sourceUrl: source.source_url,
    refreshInterval: source.refresh_interval,
    nextSyncAt: source.next_sync_at,
    lastSyncedAt: source.last_synced_at,
    lastError: source.last_error,
    documentCount: documentsResult.count ?? 0,
    chunkCount: activeChunks.length,
    embeddingCounts,
    latestSyncRun: run ?? null,
  })

  return { ok: true, value: payload }
}

export async function reprocessBackstageKnowledgeSource(
  tenantId: string,
  sourceId: string,
): Promise<{ ok: boolean; message: string }> {
  await requirePlatformAdmin()

  const admin = createAdminClient()
  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id, type, name, sync_enabled')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError) return { ok: false, message: sourceError.message }
  if (!source) return { ok: false, message: 'Fuente no encontrada.' }

  const result = isManagedWebSourceType(source.type)
    ? source.sync_enabled
      ? await queueManagedWebSourceFromBackstage(admin, tenantId, sourceId)
      : { ok: false, message: 'Reactiva la sincronización antes de actualizar esta fuente.' }
    : source.type === 'pdf'
    ? await reprocessStoredKnowledgeSource({ admin, tenantId, sourceId })
    : source.type === 'manual' || source.type === 'xlsx' || source.type === 'csv'
      ? await reindexStructuredKnowledgeSource({
        admin,
        tenantId,
        sourceId,
        sourceType: source.type,
        sourceName: source.name,
      })
      : { ok: false, message: 'Este tipo de fuente no se puede reprocesar desde Backstage.' }

  revalidatePath(`/backstage/tenants/${tenantId}`)
  revalidatePath(`/${tenantId}/knowledge`)

  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true, message: result.message }
}

export async function setBackstageManagedWebSyncEnabled(
  tenantId: string,
  sourceId: string,
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  await requirePlatformAdmin()

  const admin = createAdminClient()
  const { error } = await admin.rpc('set_knowledge_web_sync_enabled', {
    p_theatre_id: tenantId,
    p_source_id: sourceId,
    p_enabled: enabled,
  })

  if (error) {
    return { ok: false, message: `No se pudo ${enabled ? 'reactivar' : 'pausar'} la fuente: ${error.message}` }
  }

  revalidatePath('/backstage')
  revalidatePath(`/backstage/tenants/${tenantId}`)
  revalidatePath(`/${tenantId}/knowledge`)

  return {
    ok: true,
    message: enabled
      ? 'Sincronización reactivada. La fuente programada queda preparada para el siguiente worker.'
      : 'Sincronización pausada. Los jobs en cola se han cancelado y el conocimiento actual se conserva.',
  }
}

export async function setBackstageProgrammeExtractionEnabled(
  tenantId: string,
  sourceId: string,
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  const platformAccess = await requirePlatformAdmin()
  const parsed = z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
    enabled: z.boolean(),
  }).safeParse({ tenantId, sourceId, enabled })
  if (!parsed.success) return { ok: false, message: 'La referencia de la fuente no es válida.' }

  const admin = createAdminClient()
  const [{ data: source, error: sourceError }, { data: venue, error: venueError }] = await Promise.all([
    admin
      .from('knowledge_sources')
      .select('id, type, config, sync_enabled')
      .eq('id', sourceId)
      .eq('theatre_id', tenantId)
      .maybeSingle(),
    admin
      .from('theatres')
      .select('account_id')
      .eq('id', tenantId)
      .maybeSingle(),
  ])
  if (sourceError || venueError) {
    return { ok: false, message: sourceError?.message ?? venueError?.message ?? 'No se pudo cargar la fuente.' }
  }
  if (!source || !venue) return { ok: false, message: 'Fuente no encontrada.' }
  if (!isManagedWebSourceType(source.type)) {
    return { ok: false, message: 'La extracción de programación solo está disponible para fuentes web gestionadas.' }
  }

  const { error: updateError } = await admin
    .from('knowledge_sources')
    .update({ config: withProgrammeExtractionEnabled(source.config, enabled) })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
  if (updateError) return { ok: false, message: `No se pudo guardar la configuración: ${updateError.message}` }

  const { error: auditError } = await admin.from('audit_events').insert({
    account_id: venue.account_id,
    theatre_id: tenantId,
    actor_user_id: platformAccess.user.id,
    action: enabled ? 'knowledge.programme_extraction_enabled' : 'knowledge.programme_extraction_disabled',
    target_type: 'knowledge_source',
    target_id: sourceId,
    metadata: { source_type: source.type },
  })
  if (auditError) {
    console.error('[backstage-programme-extraction] failed to record audit event', {
      tenantId,
      sourceId,
      error: auditError.message,
    })
  }

  const queued = enabled && source.sync_enabled
    ? await queueManagedWebSourceFromBackstage(admin, tenantId, sourceId)
    : null

  revalidatePath('/backstage')
  revalidatePath(`/backstage/tenants/${tenantId}`)
  revalidatePath(`/${tenantId}/knowledge`)

  if (queued && !queued.ok) {
    return {
      ok: false,
      message: `La extracción quedó activada, pero no se pudo poner la fuente en cola: ${queued.message}`,
    }
  }
  return {
    ok: true,
    message: enabled
      ? `Extracción estructurada activada.${queued ? ` ${queued.message}` : ' Se aplicará en la próxima sincronización.'}`
      : 'Extracción estructurada desactivada. Los eventos dejan de participar en consultas actuales.',
  }
}

export async function deleteBackstageKnowledgeSource(
  tenantId: string,
  sourceId: string,
): Promise<{ ok: boolean; message: string }> {
  const platformAccess = await requirePlatformAdmin()
  const admin = createAdminClient()
  const { data: venue, error: venueError } = await admin
    .from('theatres')
    .select('account_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (venueError) return { ok: false, message: venueError.message }
  if (!venue) return { ok: false, message: 'Venue no encontrado.' }

  const result = await deleteKnowledgeSourceData({ admin, tenantId, sourceId })
  if (!result.ok) return { ok: false, message: `No se pudo eliminar la fuente: ${result.error}` }

  const audit = await admin.from('audit_events').insert({
    account_id: venue.account_id,
    theatre_id: tenantId,
    actor_user_id: platformAccess.user.id,
    action: 'knowledge.source_deleted_from_backstage',
    target_type: 'knowledge_source',
    target_id: result.source.id,
    metadata: {
      source_name: result.source.name,
      source_type: result.source.type,
      storage_cleanup: result.storageCleanupError ? 'failed' : 'completed_or_not_required',
      storage_cleanup_error: result.storageCleanupError ?? null,
    },
  })

  if (audit.error) {
    console.error('[backstage-knowledge-source-delete] failed to record audit event', {
      tenantId,
      sourceId,
      error: audit.error.message,
    })
  }

  revalidatePath('/backstage')
  revalidatePath(`/backstage/tenants/${tenantId}`)
  revalidatePath(`/${tenantId}/knowledge`)
  revalidatePath(`/${tenantId}/overview`)

  return {
    ok: true,
    message: result.storageCleanupError
      ? `Fuente eliminada. El conocimiento dejó de estar disponible, pero no se pudo limpiar el archivo de Storage: ${result.storageCleanupError}`
      : `Fuente "${result.source.name}" eliminada junto con su conocimiento procesado.`,
  }
}

async function queueManagedWebSourceFromBackstage(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  sourceId: string,
) {
  const { data: activeRun, error: activeError } = await admin
    .from('knowledge_sync_runs')
    .select('id')
    .eq('source_id', sourceId)
    .eq('theatre_id', tenantId)
    .in('status', ['queued', 'running'])
    .maybeSingle()

  if (activeError) return { ok: false, message: activeError.message }
  if (activeRun) return { ok: true, message: 'La fuente ya está en cola o actualizándose.' }

  const queued = await admin
    .from('knowledge_sync_runs')
    .insert({
      theatre_id: tenantId,
      source_id: sourceId,
      trigger: 'manual',
      status: 'queued',
      idempotency_key: `backstage:${sourceId}:${randomUUID()}`,
    })

  if (queued.error && queued.error.code !== '23505') {
    return { ok: false, message: queued.error.message }
  }

  await admin
    .from('knowledge_sources')
    .update({ next_sync_at: new Date().toISOString() })
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  return { ok: true, message: 'Actualización web añadida a la cola.' }
}

export async function reindexBackstageTenantKnowledge(
  tenantId: string,
): Promise<{ ok: boolean; message: string }> {
  await requirePlatformAdmin()

  const admin = createAdminClient()
  const result = await reindexTenantKnowledgeSources({ admin, tenantId })

  revalidatePath(`/backstage/tenants/${tenantId}`)
  revalidatePath(`/${tenantId}/knowledge`)

  return { ok: result.ok, message: result.message }
}

export async function retryBackstageKnowledgeSourceEmbeddings(
  tenantId: string,
  sourceId: string,
): Promise<{ ok: boolean; message: string }> {
  await requirePlatformAdmin()

  const admin = createAdminClient()
  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError) return { ok: false, message: sourceError.message }
  if (!source) return { ok: false, message: 'Fuente no encontrada.' }

  const { count, error: countError } = await admin
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', sourceId)
    .eq('theatre_id', tenantId)
    .eq('active', true)
    .in('embedding_status', ['pending', 'error'])

  if (countError) return { ok: false, message: countError.message }

  const result = await embedKnowledgeSourceWithTaliaAi({
    tenantId,
    sourceId,
    limit: Math.max(1, count ?? 100),
    retryErrors: true,
  })

  revalidatePath(`/backstage/tenants/${tenantId}`)
  revalidatePath(`/${tenantId}/knowledge`)

  if (!result) {
    return { ok: false, message: 'TALIA AI no está configurado para generar embeddings.' }
  }

  if (!result.ok) {
    return {
      ok: false,
      message: `No se pudieron reintentar embeddings: ${result.error ?? 'error desconocido'}`,
    }
  }

  return {
    ok: true,
    message: `Embeddings revisados: ${result.checked}. Generados: ${result.embedded}. Omitidos: ${result.skipped}. Errores: ${result.failed}.`,
  }
}
