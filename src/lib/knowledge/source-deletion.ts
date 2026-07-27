import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type KnowledgeSourceDeletionResult =
  | {
      ok: true
      source: {
        id: string
        name: string
        type: string
      }
      storageCleanupError?: string
    }
  | {
      ok: false
      error: string
    }

export async function deleteKnowledgeSourceData({
  admin,
  tenantId,
  sourceId,
}: {
  admin: AdminClient
  tenantId: string
  sourceId: string
}): Promise<KnowledgeSourceDeletionResult> {
  const { data: source, error: sourceError } = await admin
    .from('knowledge_sources')
    .select('id, name, type, config')
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)
    .maybeSingle()

  if (sourceError) return { ok: false, error: sourceError.message }
  if (!source) return { ok: false, error: 'Fuente no encontrada.' }

  const config = isRecord(source.config) ? source.config : {}
  const storageBucket = typeof config.storage_bucket === 'string' ? config.storage_bucket : null
  const storagePath = typeof config.storage_path === 'string' ? config.storage_path : null

  // knowledge_items uses ON DELETE SET NULL, so remove linked structured
  // knowledge first. Chunks, documents, sync runs and support requests cascade.
  const itemsDelete = await admin
    .from('knowledge_items')
    .delete()
    .eq('source_id', sourceId)
    .eq('theatre_id', tenantId)

  if (itemsDelete.error) return { ok: false, error: itemsDelete.error.message }

  const sourceDelete = await admin
    .from('knowledge_sources')
    .delete()
    .eq('id', sourceId)
    .eq('theatre_id', tenantId)

  if (sourceDelete.error) return { ok: false, error: sourceDelete.error.message }

  let storageCleanupError: string | undefined
  if (storageBucket && storagePath) {
    const removed = await admin.storage.from(storageBucket).remove([storagePath])
    storageCleanupError = removed.error?.message
  }

  return {
    ok: true,
    source: {
      id: source.id,
      name: source.name,
      type: source.type,
    },
    ...(storageCleanupError ? { storageCleanupError } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
