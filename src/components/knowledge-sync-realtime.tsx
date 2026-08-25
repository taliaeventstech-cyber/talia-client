'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { KnowledgeSyncActivity, KnowledgeSyncStage } from '@/lib/knowledge/sync-activity'

export type KnowledgeSyncRealtimeLabels = {
  stages: Record<KnowledgeSyncStage, string>
  pagesReviewed: string
  fragmentsReady: string
  connected: string
  connecting: string
  reconnecting: string
}

const defaultLabels: KnowledgeSyncRealtimeLabels = {
  stages: {
    queued: 'En cola',
    discovering: 'Descubriendo páginas',
    fetching: 'Revisando páginas',
    chunking: 'Preparando contenido',
    finishing: 'Finalizando actualización',
    embeddings: 'Preparando conocimiento',
  },
  pagesReviewed: 'páginas revisadas',
  fragmentsReady: 'fragmentos listos',
  connected: 'Actualización en tiempo real',
  connecting: 'Conectando seguimiento',
  reconnecting: 'Reconectando seguimiento',
}

export function KnowledgeSyncRealtime({
  activity,
  labels = defaultLabels,
}: {
  activity: KnowledgeSyncActivity
  labels?: KnowledgeSyncRealtimeLabels
}) {
  const router = useRouter()

  useEffect(() => {
    if (!activity.requiresPolling) return

    const pollTimer = setInterval(() => router.refresh(), 8_000)
    return () => clearInterval(pollTimer)
  }, [activity.requiresPolling, router])

  const progress = activity.current !== null && activity.total !== null
    ? `${activity.current}/${activity.total} ${
      activity.stage === 'embeddings' ? labels.fragmentsReady : labels.pagesReviewed
    }`
    : null
  return (
    <span
      className={`knowledge-realtime-status knowledge-realtime-status-connected knowledge-realtime-stage-${activity.stage}`}
      role="status"
      aria-live="polite"
    >
      <span className="knowledge-realtime-dot" aria-hidden="true" />
      <span className="knowledge-realtime-copy">
        <strong>{labels.stages[activity.stage]}</strong>
        <small>
          {activity.sourceName}
          {progress ? ` · ${progress}` : ''}
          {` · ${labels.connected}`}
        </small>
      </span>
    </span>
  )
}
