import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type BackstageKnowledgeHealthCounts = {
  sourceCount: number
  readySources: number
  errorSources: number
  totalChunks: number
  readyChunks: number
  pendingChunks: number
  processingChunks: number
  errorChunks: number
}

export type BackstageKnowledgeHealth = {
  available: boolean
  sourceCount: number | null
  readySources: number | null
  errorSources: number | null
  totalChunks: number | null
  readyChunks: number | null
  pendingChunks: number | null
  processingChunks: number | null
  errorChunks: number | null
  errorCount: number | null
  readinessPercent: number | null
  statusClass: string
  statusLabel: string
  notice: string | null
  noticeTone: string
}

type CountQueryResult = {
  count: number | null
  error: { message: string } | null
}

export type BackstageKnowledgeChunkRow = {
  source_id: string | null
  embedding_status: string
  active: boolean
}

export async function loadBackstageKnowledgeHealth(
  admin: AdminClient,
  tenantId: string,
): Promise<{ counts: BackstageKnowledgeHealthCounts | null; error: string | null }> {
  const sourceCountQuery = () => admin
    .from('knowledge_sources')
    .select('id', { count: 'exact', head: true })
    .eq('theatre_id', tenantId)

  const chunkCountQuery = () => admin
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('theatre_id', tenantId)
    .eq('active', true)

  const results = await Promise.all([
    sourceCountQuery(),
    sourceCountQuery().eq('status', 'ready'),
    sourceCountQuery().eq('status', 'error'),
    chunkCountQuery(),
    chunkCountQuery().eq('embedding_status', 'ready'),
    chunkCountQuery().eq('embedding_status', 'pending'),
    chunkCountQuery().eq('embedding_status', 'processing'),
    chunkCountQuery().eq('embedding_status', 'error'),
  ])

  const failed = results.find((result) => result.error)
  if (failed?.error) {
    return { counts: null, error: failed.error.message }
  }

  const [
    sourceCount,
    readySources,
    errorSources,
    totalChunks,
    readyChunks,
    pendingChunks,
    processingChunks,
    errorChunks,
  ] = results.map(getCount)

  return {
    counts: {
      sourceCount,
      readySources,
      errorSources,
      totalChunks,
      readyChunks,
      pendingChunks,
      processingChunks,
      errorChunks,
    },
    error: null,
  }
}

export async function loadBackstageKnowledgeChunks(
  admin: AdminClient,
  {
    tenantId,
    sourceIds,
  }: {
    tenantId: string
    sourceIds: string[]
  },
): Promise<{ data: BackstageKnowledgeChunkRow[] | null; error: string | null }> {
  if (sourceIds.length === 0) return { data: [], error: null }

  const rows: BackstageKnowledgeChunkRow[] = []
  const pageSize = 1_000

  for (let from = 0; ; from += pageSize) {
    const result = await admin
      .from('knowledge_chunks')
      .select('source_id, embedding_status, active')
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .in('source_id', sourceIds)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (result.error) return { data: null, error: result.error.message }

    const page = result.data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return { data: rows, error: null }
}

export function buildBackstageKnowledgeHealth(
  counts: BackstageKnowledgeHealthCounts | null,
): BackstageKnowledgeHealth {
  if (!counts) {
    return {
      available: false,
      sourceCount: null,
      readySources: null,
      errorSources: null,
      totalChunks: null,
      readyChunks: null,
      pendingChunks: null,
      processingChunks: null,
      errorChunks: null,
      errorCount: null,
      readinessPercent: null,
      statusClass: 'status-pill-muted',
      statusLabel: 'sin datos',
      notice: 'No se ha podido consultar la salud del conocimiento. Los contadores no se muestran para evitar datos incorrectos.',
      noticeTone: 'rag-health-notice-error',
    }
  }

  const readinessPercent = counts.totalChunks > 0
    ? Math.round((counts.readyChunks / counts.totalChunks) * 100)
    : 0
  const errorCount = counts.errorSources + counts.errorChunks
  const hasPending = counts.pendingChunks > 0 || counts.processingChunks > 0

  if (counts.sourceCount === 0) {
    return {
      ...counts,
      available: true,
      errorCount,
      readinessPercent,
      statusClass: 'status-pill-muted',
      statusLabel: 'sin fuentes',
      notice: 'Este venue todavía no tiene fuentes preparadas para retrieval.',
      noticeTone: 'rag-health-notice-muted',
    }
  }

  if (errorCount > 0) {
    return {
      ...counts,
      available: true,
      errorCount,
      readinessPercent,
      statusClass: 'status-pill-danger',
      statusLabel: 'revisar',
      notice: 'Hay fuentes o embeddings con error. Reintenta embeddings o reprocesa la fuente desde Backstage.',
      noticeTone: 'rag-health-notice-error',
    }
  }

  if (hasPending) {
    return {
      ...counts,
      available: true,
      errorCount,
      readinessPercent,
      statusClass: 'status-pill-soon',
      statusLabel: 'procesando',
      notice: 'Hay embeddings pendientes o en proceso. Si no avanzan, usa el reintento desde Backstage.',
      noticeTone: 'rag-health-notice-warning',
    }
  }

  return {
    ...counts,
    available: true,
    errorCount,
    readinessPercent,
    statusClass: 'status-pill-active',
    statusLabel: 'operativo',
    notice: null,
    noticeTone: 'rag-health-notice-muted',
  }
}

function getCount(result: CountQueryResult) {
  return result.count ?? 0
}
