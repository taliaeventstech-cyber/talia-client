'use client'

import { PencilLine } from 'lucide-react'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

export function ProcessEmailSubmitButton({ label, processingLabel }: { label: string; processingLabel: string }) {
  const { pending } = useFormStatus()
  const [startedHere, setStartedHere] = useState(false)
  const isProcessing = pending && startedHere

  return (
    <button
      className={`button-primary button-fit email-processing-button ${isProcessing ? 'email-processing-button-active' : ''}`}
      disabled={pending}
      onClick={() => setStartedHere(true)}
      type="submit"
    >
      {isProcessing ? (
        <>
          <span>{processingLabel}</span>
          <span className="processing-line" aria-hidden="true" />
        </>
      ) : (
        <>
          <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
