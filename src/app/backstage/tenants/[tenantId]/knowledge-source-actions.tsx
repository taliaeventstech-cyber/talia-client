'use client'

import { ToastNotice } from '@/components/ui/toast-notice'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { reprocessBackstageKnowledgeSource, retryBackstageKnowledgeSourceEmbeddings } from './actions'

type ToastState = {
  id: number
  message: string
  tone: 'success' | 'error'
}

export function BackstageReprocessSourceButton({
  tenantId,
  sourceId,
}: {
  tenantId: string
  sourceId: string
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
        {isPending ? 'Reprocesando...' : 'Reprocesar PDF'}
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
