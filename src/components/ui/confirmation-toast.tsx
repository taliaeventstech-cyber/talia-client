'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

type ConfirmationToastProps = {
  message: string
  cancelLabel: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationToast({
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmationToastProps) {
  const messageId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className="confirmation-toast" role="alertdialog" aria-modal="false" aria-describedby={messageId}>
      <span className="confirmation-toast-icon" aria-hidden="true">
        <AlertTriangle size={18} strokeWidth={2} />
      </span>
      <div className="confirmation-toast-content">
        <p id={messageId}>{message}</p>
        <div className="confirmation-toast-actions">
          <button type="button" className="confirmation-toast-discard" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button ref={cancelRef} type="button" className="confirmation-toast-continue" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
