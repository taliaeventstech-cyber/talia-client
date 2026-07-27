export type KnowledgeSyncStage =
  | 'queued'
  | 'discovering'
  | 'fetching'
  | 'chunking'
  | 'finishing'
  | 'embeddings'

export type KnowledgeEmbeddingCounts = {
  ready: number
  pending: number
  processing: number
  error: number
}

type KnowledgeSyncRun = {
  status: string
  discovered_count: number
  checked_count: number
  metadata: unknown
}

export type KnowledgeSyncActivitySource = {
  name: string
  syncEnabled: boolean
  latestSyncRun: KnowledgeSyncRun | null
  embeddingCounts: KnowledgeEmbeddingCounts
}

export type KnowledgeSyncActivity = {
  stage: KnowledgeSyncStage
  sourceName: string
  current: number | null
  total: number | null
  requiresPolling: boolean
}

const stagePriority: Record<KnowledgeSyncStage, number> = {
  discovering: 0,
  fetching: 0,
  chunking: 0,
  finishing: 0,
  queued: 1,
  embeddings: 2,
}

export function getKnowledgeSyncActivity(
  sources: KnowledgeSyncActivitySource[],
): KnowledgeSyncActivity | null {
  const activities = sources
    .map(getSourceSyncActivity)
    .filter((activity): activity is KnowledgeSyncActivity => activity !== null)

  return activities.sort((left, right) => stagePriority[left.stage] - stagePriority[right.stage])[0] ?? null
}

function getSourceSyncActivity(source: KnowledgeSyncActivitySource): KnowledgeSyncActivity | null {
  if (!source.syncEnabled) return null

  const run = source.latestSyncRun
  if (run?.status === 'queued') {
    return activity(source.name, 'queued')
  }

  if (run?.status === 'running') {
    const stage = getRunStage(run.metadata)
    const hasPageProgress = stage === 'fetching' && run.discovered_count > 0
    return activity(
      source.name,
      stage,
      hasPageProgress ? run.checked_count : null,
      hasPageProgress ? run.discovered_count : null,
    )
  }

  const embeddingsTotal = Object.values(source.embeddingCounts)
    .reduce((total, count) => total + Math.max(0, count), 0)
  const embeddingsInProgress = source.embeddingCounts.pending + source.embeddingCounts.processing
  if (
    (run?.status === 'succeeded' || run?.status === 'partial')
    && embeddingsTotal > 0
    && embeddingsInProgress > 0
  ) {
    return activity(
      source.name,
      'embeddings',
      source.embeddingCounts.ready,
      embeddingsTotal,
      true,
    )
  }

  return null
}

function activity(
  sourceName: string,
  stage: KnowledgeSyncStage,
  current: number | null = null,
  total: number | null = null,
  requiresPolling = false,
): KnowledgeSyncActivity {
  return { stage, sourceName, current, total, requiresPolling }
}

function getRunStage(metadata: unknown): Exclude<KnowledgeSyncStage, 'queued' | 'embeddings'> {
  const phase = metadata && typeof metadata === 'object' && 'phase' in metadata
    ? (metadata as { phase?: unknown }).phase
    : null

  if (phase === 'discovering' || phase === 'fetching' || phase === 'chunking' || phase === 'finishing') {
    return phase
  }

  return 'discovering'
}
