'use client'

import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

interface EmptySyncSubmitButtonProps {
  title: string
  description: string
  label: string
  syncingLabel: string
}

export function EmptySyncSubmitButton({
  title,
  description,
  label,
  syncingLabel,
}: EmptySyncSubmitButtonProps) {
  const { pending } = useFormStatus()
  const [startedHere, setStartedHere] = useState(false)
  const isSyncing = pending && startedHere

  return (
    <button
      aria-busy={isSyncing}
      className={`email-empty-sync-button ${isSyncing ? 'email-empty-sync-button-active' : ''}`}
      disabled={pending}
      onClick={() => setStartedHere(true)}
      type="submit"
    >
      <span className="email-empty-sync-icon" aria-hidden="true">
        <RefreshCw size={18} />
      </span>
      <span className="email-empty-sync-copy">
        <strong>{isSyncing ? syncingLabel : title}</strong>
        <span>{description}</span>
      </span>
      <span className="email-empty-sync-action">
        {isSyncing ? (
          <>
            {syncingLabel}
            <span className="processing-line" aria-hidden="true" />
          </>
        ) : label}
      </span>
    </button>
  )
}
