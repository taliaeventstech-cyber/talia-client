'use client'

import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

type SelectedDeleteSubmitButtonProps = {
  formAction: (formData: FormData) => void | Promise<void>
  labels: {
    cancel: string
    confirm: string
    delete: string
    deleting: string
    question: string
    yes: string
  }
  targetName: string
}

export function SelectedDeleteSubmitButton({ formAction, labels, targetName }: SelectedDeleteSubmitButtonProps) {
  const { pending } = useFormStatus()
  const [hasSelection, setHasSelection] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return

    const updateSelection = () => {
      const selected = Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${targetName}"]`))
        .some((input) => input.checked)
      setHasSelection(selected)
      if (!selected && !pending) setConfirming(false)
    }

    form.addEventListener('change', updateSelection)
    updateSelection()

    return () => form.removeEventListener('change', updateSelection)
  }, [pending, targetName])

  return (
    <span className="draft-delete-choice" ref={rootRef}>
      {confirming ? (
        <span className="draft-delete-inline-confirm">
          <span className="draft-delete-inline-question">
            {labels.question}
          </span>
          <span className="delete-inline-actions">
            <button
              className="button-outline button-danger button-fit"
              disabled={pending}
              formAction={formAction}
              type="submit"
            >
              {pending ? (
                <>{labels.deleting}<span className="inline-loading-dots" aria-hidden="true" /></>
              ) : labels.yes}
            </button>
            <button
              className="button-outline button-fit"
              disabled={pending}
              type="button"
              onClick={() => setConfirming(false)}
            >
              {labels.cancel}
            </button>
          </span>
        </span>
      ) : (
        <button
          aria-disabled={!hasSelection || pending}
          className="button-outline button-danger button-fit"
          disabled={!hasSelection || pending}
          onClick={() => setConfirming(true)}
          type="button"
        >
          <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
          {labels.delete}
        </button>
      )}
    </span>
  )
}
