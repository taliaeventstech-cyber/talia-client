'use client'

import { ToastNotice } from '@/components/ui/toast-notice'
import { CirclePause, CirclePlay, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { reindexBackstageTenantKnowledge, reprocessBackstageKnowledgeSource, retryBackstageKnowledgeSourceEmbeddings, setBackstageManagedWebSyncEnabled } from './actions'

type ToastState = {
  id: number
  message: string
  tone: 'success' | 'error'
}

export function BackstageReprocessSourceButton({
  tenantId,
  sourceId,
  sourceType = 'pdf',
}: {
  tenantId: string
  sourceId: string
  sourceType?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleReprocess() {
    startTransition(async () => {
      const result = await reprocessBackstageKnowledgeSource(tenantId, sourceId)
      setToast({
        id: Date.now(),
        message: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      router.refresh()
    })
  }

  return (
    <>
      {toast ? <ToastNotice key={toast.id} message={toast.message} tone={toast.tone} /> : null}
      <button
        type="button"
        className="knowledge-retry-button"
        onClick={handleReprocess}
        disabled={isPending}
      >
        <RefreshCw size={13} strokeWidth={2.2} aria-hidden="true" />
        {isPending ? 'Reprocesando...' : getReprocessLabel(sourceType)}
      </button>
    </>
  )
}

export function BackstageReindexTenantKnowledgeButton({
  tenantId,
}: {
  tenantId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleReindex() {
    startTransition(async () => {
      const result = await reindexBackstageTenantKnowledge(tenantId)
      setToast({
        id: Date.now(),
        message: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      router.refresh()
    })
  }

  return (
    <>
      {toast ? <ToastNotice key={toast.id} message={toast.message} tone={toast.tone} /> : null}
      <button
        type="button"
        className="button-outline"
        onClick={handleReindex}
        disabled={isPending}
      >
        <RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />
        {isPending ? 'Reindexando...' : 'Reindexar conocimiento'}
      </button>
    </>
  )
}

export function BackstageRetryEmbeddingsButton({
  tenantId,
  sourceId,
}: {
  tenantId: string
  sourceId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleRetry() {
    startTransition(async () => {
      const result = await retryBackstageKnowledgeSourceEmbeddings(tenantId, sourceId)
      setToast({
        id: Date.now(),
        message: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      router.refresh()
    })
  }

  return (
    <>
      {toast ? <ToastNotice key={toast.id} message={toast.message} tone={toast.tone} /> : null}
      <button
        type="button"
        className="knowledge-retry-button"
        onClick={handleRetry}
        disabled={isPending}
      >
        <RefreshCw size={13} strokeWidth={2.2} aria-hidden="true" />
        {isPending ? 'Reintentando...' : 'Reintentar embeddings'}
      </button>
    </>
  )
}

export function BackstageManagedWebSyncToggle({
  tenantId,
  sourceId,
  enabled,
}: {
  tenantId: string
  sourceId: string
  enabled: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleToggle() {
    startTransition(async () => {
      const result = await setBackstageManagedWebSyncEnabled(tenantId, sourceId, !enabled)
      setToast({
        id: Date.now(),
        message: result.message,
        tone: result.ok ? 'success' : 'error',
      })
      router.refresh()
    })
  }

  return (
    <>
      {toast ? <ToastNotice key={toast.id} message={toast.message} tone={toast.tone} /> : null}
      <button
        type="button"
        className="knowledge-retry-button"
        onClick={handleToggle}
        disabled={isPending}
        aria-label={enabled ? 'Pausar fuente web' : 'Habilitar fuente web'}
      >
        {enabled
          ? <CirclePause size={13} strokeWidth={2.2} aria-hidden="true" />
          : <CirclePlay size={13} strokeWidth={2.2} aria-hidden="true" />}
        {isPending ? 'Guardando...' : enabled ? 'Pausar fuente' : 'Habilitar fuente'}
      </button>
    </>
  )
}

function getReprocessLabel(sourceType: string) {
  if (sourceType === 'pdf') return 'Reprocesar PDF'
  if (sourceType === 'url' || sourceType === 'sitemap' || sourceType === 'website') return 'Actualizar fuente'
  if (sourceType === 'manual') return 'Reindexar FAQs'
  if (sourceType === 'xlsx' || sourceType === 'csv') return 'Reindexar archivo'
  return 'Reindexar fuente'
}
