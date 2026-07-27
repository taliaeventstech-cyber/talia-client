'use server'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { reindexStructuredKnowledgeSource, reindexTenantKnowledgeSources, reprocessStoredKnowledgeSource } from '@/lib/knowledge/ingestion'
import { embedKnowledgeSourceWithTaliaAi } from '@/lib/knowledge/talia-ai-embeddings'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { isManagedWebSourceType } from '@/lib/knowledge/managed-web-sources'
import { deleteKnowledgeSourceData } from '@/lib/knowledge/source-deletion'
import { randomUUID } from 'node:crypto'

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
