'use client'

import type { WhatsappConnectionCopy } from '@/lib/i18n/whatsapp-connection-copy'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { disconnectWhatsappConnectionAction } from './actions'

export function DisconnectWhatsappConnectionButton({
  connectionId,
  copy,
  tenantId,
}: {
  connectionId: string
  copy: WhatsappConnectionCopy
  tenantId: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function disconnect() {
    setFeedback(null)
    startTransition(async () => {
      const result = await disconnectWhatsappConnectionAction(tenantId, connectionId)
      if (!result.ok) {
        setFeedback(copy.disconnectError)
        return
      }
      if (result.providerWarning) {
        setFeedback(copy.disconnectProviderWarning)
        window.setTimeout(() => router.refresh(), 2_500)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="stack whatsapp-disconnect-action">
      {confirming ? (
        <div className="whatsapp-disconnect-confirmation" role="alertdialog" aria-describedby="whatsapp-disconnect-description">
          <p id="whatsapp-disconnect-description">{copy.disconnectConfirmation}</p>
          <div className="whatsapp-disconnect-buttons">
            <button
              className="button-outline button-danger button-fit"
              disabled={isPending}
              onClick={disconnect}
              type="button"
            >
              {isPending ? copy.disconnecting : copy.confirmDisconnect}
            </button>
            <button
              className="button-outline button-fit"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              type="button"
            >
              {copy.cancelDisconnect}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="button-outline button-danger button-fit"
          onClick={() => setConfirming(true)}
          type="button"
        >
          {copy.disconnect}
        </button>
      )}
      {feedback ? <p className="notice notice-error" role="alert">{feedback}</p> : null}
    </div>
  )
}
