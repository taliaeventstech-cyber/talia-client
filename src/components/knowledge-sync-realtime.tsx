'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ConnectionState = 'connecting' | 'connected' | 'reconnecting'

export function KnowledgeSyncRealtime({ tenantId, hasActiveRun }: { tenantId: string; hasActiveRun: boolean }) {
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
      if (!hasActiveRun || pollTimer) return
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
  }, [hasActiveRun, router, tenantId])

  return (
    <span className={`knowledge-realtime-status knowledge-realtime-status-${connection}`} role="status">
      <span aria-hidden="true" />
      {connection === 'connected'
        ? 'Sincronización en curso'
        : connection === 'reconnecting'
          ? 'Reconectando seguimiento'
          : 'Conectando seguimiento'}
    </span>
  )
}
