'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

type ConfirmationToastProps = {
  title: string
  message: string
  discardLabel: string
  saveLabel: string
  saving: boolean
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}

export function ConfirmationToast({
  title,
  message,
  discardLabel,
  saveLabel,
  saving,
  onCancel,
  onDiscard,
  onSave,
}: ConfirmationToastProps) {
  const descriptionId = useId()
  const saveRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    saveRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="confirmation-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby={descriptionId}>
        <span className="confirmation-modal-icon" aria-hidden="true">
          <AlertTriangle size={20} strokeWidth={2} />
        </span>
        <div className="confirmation-modal-content">
          <h2 id="confirmation-title">{title}</h2>
          <p id={descriptionId}>{message}</p>
          <div className="confirmation-modal-actions">
            <button type="button" className="button-outline button-danger" onClick={onDiscard} disabled={saving}>
              {discardLabel}
            </button>
            <button ref={saveRef} type="button" className="button-primary" onClick={onSave} disabled={saving}>
              {saving ? `${saveLabel}…` : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
