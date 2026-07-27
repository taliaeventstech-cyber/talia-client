'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { KnowledgeSyncActivity, KnowledgeSyncStage } from '@/lib/knowledge/sync-activity'
import { createClient } from '@/lib/supabase/client'

type ConnectionState = 'connecting' | 'connected' | 'reconnecting'

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
  tenantId,
  activity,
  labels = defaultLabels,
}: {
  tenantId: string
  activity: KnowledgeSyncActivity
  labels?: KnowledgeSyncRealtimeLabels
}) {
  const router = useRouter()
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let pollTimer: ReturnType<typeof setInterval> | null = null
    const reconcile = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), 250)
    }
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
    }
    const startPolling = () => {
      if (pollTimer) return
      pollTimer = setInterval(() => router.refresh(), 8_000)
    }
    const channel = supabase.channel(`knowledge-sync:${tenantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'knowledge_sync_runs', filter: `theatre_id=eq.${tenantId}`,
      }, reconcile)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('connected')
          stopPolling()
          if (activity.requiresPolling) startPolling()
          reconcile()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('reconnecting')
          startPolling()
        }
      })
    return () => {
      stopPolling()
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [activity.requiresPolling, router, tenantId])

  const progress = activity.current !== null && activity.total !== null
    ? `${activity.current}/${activity.total} ${
      activity.stage === 'embeddings' ? labels.fragmentsReady : labels.pagesReviewed
    }`
    : null
  const connectionLabel = connection === 'connected'
    ? labels.connected
    : connection === 'reconnecting'
      ? labels.reconnecting
      : labels.connecting

  return (
    <span
      className={`knowledge-realtime-status knowledge-realtime-status-${connection} knowledge-realtime-stage-${activity.stage}`}
      role="status"
      aria-live="polite"
    >
      <span className="knowledge-realtime-dot" aria-hidden="true" />
      <span className="knowledge-realtime-copy">
        <strong>{labels.stages[activity.stage]}</strong>
        <small>
          {activity.sourceName}
          {progress ? ` · ${progress}` : ''}
          {` · ${connectionLabel}`}
        </small>
      </span>
    </span>
  )
}
