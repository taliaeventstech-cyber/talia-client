'use client'

import { ToastNotice } from '@/components/ui/toast-notice'
import { CirclePause, CirclePlay, ListTree, RefreshCw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { deleteBackstageKnowledgeSource, reindexBackstageTenantKnowledge, reprocessBackstageKnowledgeSource, retryBackstageKnowledgeSourceEmbeddings, setBackstageManagedWebSyncEnabled, setBackstageProgrammeExtractionEnabled } from './actions'

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

export function BackstageProgrammeExtractionToggle({
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
      const result = await setBackstageProgrammeExtractionEnabled(tenantId, sourceId, !enabled)
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
        aria-label={enabled ? 'Desactivar extracción de eventos' : 'Activar extracción de eventos'}
      >
        <ListTree size={13} strokeWidth={2.2} aria-hidden="true" />
        {isPending ? 'Guardando...' : enabled ? 'Eventos activos' : 'Estructurar eventos'}
      </button>
    </>
  )
}

export function BackstageDeleteKnowledgeSourceButton({
  tenantId,
  sourceId,
  sourceName,
}: {
  tenantId: string
  sourceId: string
  sourceName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBackstageKnowledgeSource(tenantId, sourceId)
      setToast({
        id: Date.now(),
        message: result.message,
        tone: result.ok ? 'success' : 'error',
      })

      if (result.ok) {
        setConfirming(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      {toast ? <ToastNotice key={toast.id} message={toast.message} tone={toast.tone} /> : null}
      <div className="knowledge-delete-control">
        <div className={confirming ? 'knowledge-delete-confirm knowledge-delete-confirm-open' : 'knowledge-delete-confirm'}>
          <button
            type="button"
            className="knowledge-delete-secondary"
            onClick={() => setConfirming(false)}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="knowledge-delete-danger"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
        <button
          type="button"
          className="knowledge-delete-icon"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          aria-expanded={confirming}
          aria-label={`Eliminar la fuente ${sourceName}`}
          title="Eliminar fuente y conocimiento procesado"
        >
          <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
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
