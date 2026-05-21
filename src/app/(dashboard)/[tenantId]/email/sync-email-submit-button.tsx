'use client'

import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

export function SyncEmailSubmitButton({ label, syncingLabel }: { label: string; syncingLabel: string }) {
  const { pending } = useFormStatus()
  const [startedHere, setStartedHere] = useState(false)
  const isSyncing = pending && startedHere

  return (
    <button
      className={`button-primary button-fit email-processing-button ${isSyncing ? 'email-processing-button-active' : ''}`}
      disabled={pending}
      onClick={() => setStartedHere(true)}
      type="submit"
    >
      {isSyncing ? (
        <>
          <span>{syncingLabel}</span>
          <span className="processing-line" aria-hidden="true" />
        </>
      ) : (
        <>
          <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
